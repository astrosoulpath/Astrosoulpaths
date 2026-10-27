import type { ReportSection, ReportValue } from "./report-sections";
import s from "./kundli-premium.module.css";
function Value({value}:{value:ReportValue}){
 if(typeof value!=="object")return <span dir="auto">{String(value)}</span>;
 if(Array.isArray(value))return <ol className={s.sourceList}>{value.map((item,index)=><li key={index}><Value value={item}/></li>)}</ol>;
 return <dl className={s.sourceFields}>{Object.entries(value).map(([key,item])=><div key={key}><dt>{key.replace(/_/g," ")}</dt><dd><Value value={item}/></dd></div>)}</dl>;
}
export default function ExtendedKundliReport({sections}:{sections?:ReportSection[]}){
 if(!sections?.length)return null;
 return <section className={s.extended} aria-labelledby="extended-report-title"><h3 id="extended-report-title">Detailed calculation and interpretation</h3><p>Fields supplied by the shared backend, in their recorded language. Missing sections are omitted. No new predictions, positions or dates are calculated here. Technical field labels are preserved; spiritual guidance is optional and does not replace professional advice.</p><nav aria-label="Detailed report sections">{sections.map(section=><a key={section.key} href={"#kundli-"+section.key}>{section.title}</a>)}</nav>{sections.map(section=><details className={s.report} id={"kundli-"+section.key} key={section.key}><summary>{section.title}</summary><Value value={section.value}/>{section.truncated&&<p role="note">This section exceeds the display limit. Additional supplied entries are omitted from this view; use the authorized full report PDF where available.</p>}</details>)}</section>;
}
