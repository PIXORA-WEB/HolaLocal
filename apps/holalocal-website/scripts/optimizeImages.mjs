import { deflateSync, inflateSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const output = Buffer.alloc(data.length + 12)
  output.writeUInt32BE(data.length, 0)
  name.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8)
  return output
}

async function decodePng(path) {
  const png = await readFile(path)
  if (!png.subarray(0, 8).equals(signature)) throw new Error(`${path} is not a PNG file.`)
  let offset = 8
  let header
  const compressed = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') header = data
    if (type === 'IDAT') compressed.push(data)
    offset += length + 12
  }
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const bitDepth = header[8]
  const colourType = header[9]
  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0
  if (bitDepth !== 8 || !channels || header[12] !== 0) throw new Error(`${path} uses an unsupported PNG format.`)
  const raw = inflateSync(Buffer.concat(compressed))
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  let sourceOffset = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[sourceOffset]
    sourceOffset += 1
    const rowOffset = y * stride
    for (let x = 0; x < stride; x += 1) {
      const source = raw[sourceOffset + x]
      const left = x >= channels ? pixels[rowOffset + x - channels] : 0
      const up = y > 0 ? pixels[rowOffset + x - stride] : 0
      const upLeft = y > 0 && x >= channels ? pixels[rowOffset + x - stride - channels] : 0
      let value = source
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += Math.floor((left + up) / 2)
      else if (filter === 4) {
        const estimate = left + up - upLeft
        const distances = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upLeft)]
        value += distances[0] <= distances[1] && distances[0] <= distances[2]
          ? left : distances[1] <= distances[2] ? up : upLeft
      } else if (filter !== 0) throw new Error(`${path} uses unsupported filter ${filter}.`)
      pixels[rowOffset + x] = value & 255
    }
    sourceOffset += stride
  }
  return { channels, height, pixels, width }
}

function resize(source, width, height) {
  const output = Buffer.alloc(width * height * source.channels)
  for (let y = 0; y < height; y += 1) {
    const sourceY = ((y + 0.5) * source.height) / height - 0.5
    const y0 = Math.max(Math.floor(sourceY), 0)
    const y1 = Math.min(y0 + 1, source.height - 1)
    const yWeight = Math.max(sourceY - y0, 0)
    for (let x = 0; x < width; x += 1) {
      const sourceX = ((x + 0.5) * source.width) / width - 0.5
      const x0 = Math.max(Math.floor(sourceX), 0)
      const x1 = Math.min(x0 + 1, source.width - 1)
      const xWeight = Math.max(sourceX - x0, 0)
      const to = (y * width + x) * source.channels
      for (let channel = 0; channel < source.channels; channel += 1) {
        const topLeft = source.pixels[(y0 * source.width + x0) * source.channels + channel]
        const topRight = source.pixels[(y0 * source.width + x1) * source.channels + channel]
        const bottomLeft = source.pixels[(y1 * source.width + x0) * source.channels + channel]
        const bottomRight = source.pixels[(y1 * source.width + x1) * source.channels + channel]
        const top = topLeft + (topRight - topLeft) * xWeight
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight
        output[to + channel] = Math.round(top + (bottom - top) * yWeight)
      }
    }
  }
  return { channels: source.channels, height, pixels: output, width }
}

async function encodePng(path, image) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(image.width, 0)
  header.writeUInt32BE(image.height, 4)
  header[8] = 8
  header[9] = image.channels === 4 ? 6 : 2
  const stride = image.width * image.channels
  const raw = Buffer.alloc((stride + 1) * image.height)
  for (let y = 0; y < image.height; y += 1) {
    const outputOffset = y * (stride + 1)
    raw[outputOffset] = 0
    image.pixels.copy(raw, outputOffset + 1, y * stride, (y + 1) * stride)
  }
  await writeFile(path, Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

const tasks = [
  ['src/assets/images/Favicon.png', 'src/assets/images/favicon-32.png', 32, 32],
  ['src/assets/images/Favicon.png', 'src/assets/images/favicon-192.png', 192, 192],
  ['src/assets/logos/logo-icon.png', 'src/assets/logos/logo-icon-display.png', 184, 200],
  ['src/assets/logos/logo-text.png', 'src/assets/logos/logo-text-display.png', 300, 72],
]

for (const [sourcePath, outputPath, width, height] of tasks) {
  const source = await decodePng(sourcePath)
  await encodePng(outputPath, resize(source, width, height))
  console.log(`Created ${outputPath} (${width}×${height})`)
}
