import {mkdtemp,readFile,writeFile,symlink,access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'

// The emulator controller uses path.join(projectDir, source), unlike Config.path.
// Absolute source paths therefore become incorrect nested paths in that controller.
// A temporary project uses relative paths and links to existing, unchanged repository resources.
export async function createDemoConfig(root){
  const config=JSON.parse(await readFile(resolve(root,'firebase.json'),'utf8'))
  const directory=await mkdtemp(resolve(tmpdir(),'holalocal-review-demo-config-'))
  for(const name of ['functions','firestore.rules','firestore.indexes.json','storage.rules']){
    await access(resolve(root,name));await symlink(resolve(root,name),resolve(directory,name))
  }
  config.firestore.rules='firestore.rules';config.firestore.indexes='firestore.indexes.json';config.storage.rules='storage.rules'
  config.functions=config.functions.map(item=>({...item,source:'functions'}))
  for(const [name,port] of Object.entries({auth:9099,firestore:8080,functions:5001,storage:9199,hub:4400}))config.emulators[name]={...config.emulators[name],host:'127.0.0.1',port}
  const path=resolve(directory,'firebase.json');await writeFile(path,JSON.stringify(config,null,2));return path
}
