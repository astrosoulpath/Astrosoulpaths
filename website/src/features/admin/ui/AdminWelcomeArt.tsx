export function AdminWelcomeArt() {
  return <svg className="admin-welcome-art" viewBox="0 0 240 180" fill="none" aria-hidden="true">
    <circle cx="126" cy="90" r="72" stroke="currentColor" strokeWidth=".7"/>
    <circle cx="126" cy="90" r="58" stroke="currentColor" strokeWidth=".5" strokeDasharray="2 7"/>
    <circle cx="126" cy="90" r="41" stroke="currentColor" strokeWidth=".6"/>
    {Array.from({length:12},(_,i)=><g key={i} transform={`rotate(${i*30} 126 90)`}><path d="M126 18V27M126 49V57" stroke="currentColor" strokeWidth="1"/><circle cx="126" cy="35" r="2" fill="currentColor"/></g>)}
    <circle cx="126" cy="90" r="17" fill="#D4AF37" fillOpacity=".12" stroke="currentColor"/>
    {Array.from({length:12},(_,i)=><path key={i} d="M126 65V59" transform={`rotate(${i*30} 126 90)`} stroke="currentColor" strokeLinecap="round"/>)}
    <ellipse cx="126" cy="90" rx="109" ry="35" transform="rotate(-28 126 90)" stroke="currentColor" strokeWidth=".6"/>
    <circle cx="33" cy="120" r="9" fill="#FFFDF8" stroke="currentColor"/>
    <ellipse cx="33" cy="120" rx="15" ry="4" transform="rotate(-25 33 120)" stroke="currentColor"/>
    <circle cx="210" cy="49" r="6" fill="#d4af3733" stroke="currentColor"/>
    <path d="M32 36v12m-6-6h12M215 125v10m-5-5h10M73 154v8m-4-4h8" stroke="currentColor" strokeLinecap="round"/>
  </svg>;
}
