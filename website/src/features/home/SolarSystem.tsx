import type { CSSProperties } from "react";
import styles from "./solar-system.module.css";
export const PLANETS = [
 {name:"Mercury",size:7,period:28,color:"#b4a593",detail:"The smallest planet, closest to the Sun."},
 {name:"Venus",size:12,period:39,color:"#e7c38e",detail:"Wrapped in a dense, cloudy atmosphere."},
 {name:"Earth",size:13,period:51,color:"#498ebb",detail:"Our ocean world and home."},
 {name:"Mars",size:10,period:67,color:"#c56e4c",detail:"The rust-red terrestrial planet."},
 {name:"Jupiter",size:28,period:86,color:"#c7a182",detail:"The largest planet, with banded clouds."},
 {name:"Saturn",size:23,period:108,color:"#dbc28e",detail:"A gas giant encircled by icy rings."},
 {name:"Uranus",size:16,period:133,color:"#8ecdd4",detail:"A pale blue-green ice giant."},
 {name:"Neptune",size:16,period:161,color:"#446fc3",detail:"A distant, deep-blue ice giant."},
] as const;
/** Educational illustration, not ephemeris or astronomical scale. */
export function SolarSystem(){return <figure className={styles.scene} aria-label="Animated solar system illustration, not to scale"><div className={styles.nebula} aria-hidden="true"/><div className={styles.system} aria-hidden="true"><div className={styles.sun}/>{PLANETS.map((p,index)=><div key={p.name} className={styles.orbit} style={{"--diameter":`${24+index*10}%`,"--duration":`${p.period}s`,"--phase":`${-((index*67+25)%360)/360*p.period}s`,"--angle":`${index*43}deg`} as CSSProperties}><span className={`${styles.planet} ${styles[p.name.toLowerCase()]}`} style={{"--planet-color":p.color,"--size":`${p.size}px`} as CSSProperties}/></div>)}</div><div className={styles.annotation} aria-hidden="true"><span>Our solar neighbourhood</span><span>☉ A journey of perspective</span></div><figcaption className={styles.caption}>Eight worlds. One extraordinary sky.<span>Illustration · not to scale</span></figcaption><details className={styles.planetGuide}><summary>Explore the eight planets</summary><ul>{PLANETS.map(p=><li key={p.name}><strong>{p.name}</strong><span>{p.detail}</span></li>)}</ul></details></figure>;}
