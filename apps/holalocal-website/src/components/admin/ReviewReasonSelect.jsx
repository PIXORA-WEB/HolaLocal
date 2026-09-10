import {useEffect,useId,useRef,useState} from 'react'

// Scoped select-only combobox. Reuses SelectField's styles without changing its consumers.
export default function ReviewReasonSelect({label,options,value,onChange,disabled,invalid,errorId,language}){
  const id=useId(),root=useRef(null),trigger=useRef(null),search=useRef({text:'',time:0})
  const [open,setOpen]=useState(false),[active,setActive]=useState(0),[placement,setPlacement]=useState({})
  const selected=Math.max(0,options.findIndex(option=>option.value===value))
  const expanded=open&&!disabled
  const close=()=>{setOpen(false);search.current={text:'',time:0}}
  function show(index=selected){
    if(disabled)return
    const rect=trigger.current?.getBoundingClientRect()
    if(rect){
      const below=window.innerHeight-rect.bottom-12,above=rect.top-12,up=below<200&&above>below
      setPlacement({top:up?'auto':'calc(100% + .55rem)',bottom:up?'calc(100% + .55rem)':'auto',maxHeight:Math.max(0,Math.min(272,up?above:below))})
    }
    setActive(index);setOpen(true)
  }
  function choose(index){if(disabled)return;onChange(options[index].value);close();trigger.current?.focus()}
  useEffect(()=>{
    if(!expanded)return undefined
    const outside=event=>{if(!root.current?.contains(event.target))setOpen(false)}
    const dismiss=()=>setOpen(false)
    document.addEventListener('pointerdown',outside)
    window.addEventListener('resize',dismiss)
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',dismiss)}
  },[expanded])
  useEffect(()=>{if(expanded)root.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({block:'nearest'})},[active,expanded])
  function keyDown(event){
    if(disabled)return
    const key=event.key
    if(key==='Tab'){close();return}
    if(key==='Escape'){if(expanded){event.preventDefault();close()}return}
    if(key==='ArrowDown'||key==='ArrowUp'||key==='Home'||key==='End'){
      event.preventDefault()
      const next=key==='Home'?0:key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,active+(key==='ArrowDown'?1:-1)))
      if(!expanded)show(key==='Home'||key==='End'?next:selected);else setActive(next)
      return
    }
    if(key==='Enter'||(key===' '&&(!search.current.text||Date.now()-search.current.time>=700))){
      event.preventDefault();if(expanded)choose(active);else show();return
    }
    if(key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
      event.preventDefault()
      const now=Date.now(),previous=now-search.current.time<700?search.current.text:''
      const text=(previous+key).toLocaleLowerCase(language),query=[...text].every(char=>char===text[0])?text[0]:text
      search.current={text,time:now}
      const start=expanded?active:selected
      for(let offset=1;offset<=options.length;offset++){
        const index=(start+offset)%options.length
        if(options[index].label.toLocaleLowerCase(language).startsWith(query)){if(!expanded)show(index);else setActive(index);break}
      }
    }
  }
  return <div className="admin-customer-reviews__reason-field">
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <div className="select-field select-field--form admin-customer-reviews__reason-select" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))close()}}>
      <button type="button" id={id} ref={trigger} role="combobox" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={`${id}-menu`} aria-activedescendant={expanded?`${id}-option-${active}`:undefined} aria-labelledby={`${id}-label ${id}-value`} aria-required="true" aria-invalid={invalid||undefined} aria-describedby={invalid?errorId:undefined} disabled={disabled} className="select-field__button" onKeyDown={keyDown} onClick={()=>expanded?close():show()}>
        <span id={`${id}-value`} className="select-field__label">{options[selected].label}</span><svg className="select-field__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      <div id={`${id}-menu`} role="listbox" aria-labelledby={`${id}-label`} className="select-field__menu" hidden={!expanded} style={placement}>
        {options.map((option,index)=><button type="button" tabIndex={-1} role="option" id={`${id}-option-${index}`} data-option-index={index} aria-selected={option.value===value} className={active===index?'is-active':''} key={option.value} onPointerDown={event=>event.preventDefault()} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===value&&<span aria-hidden="true">✓</span>}</button>)}
      </div>
    </div>
  </div>
}
