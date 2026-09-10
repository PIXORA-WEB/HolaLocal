import {useEffect,useState} from 'react'
import {customerReviewService} from '../services/customerReviewService.js'
import {customerReviewsEnabled} from '../utils/customerReviewsFlag.js'
export default function useReviewSummaries(ids,attempt=0) {
  const token=JSON.stringify([...new Set(ids)].sort())
  const [result,setResult]=useState({token:null,values:{}})
  useEffect(()=>{
    if(!customerReviewsEnabled)return
    let active=true
    const requested=JSON.parse(token)
    void (async()=>{
      const values={}
      for(let offset=0;offset<requested.length;offset+=20){
        const businessIds=requested.slice(offset,offset+20)
        try{for(const row of await customerReviewService.summaries({businessIds}))values[row.businessId]=row}
        catch{for(const businessId of businessIds)values[businessId]={available:false}}
        if(!active)return
      }
      if(active)setResult({token,values})
    })()
    return()=>{active=false}
  },[token,attempt])
  return result.token===token?result.values:{}
}
