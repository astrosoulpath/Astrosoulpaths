import type { Metadata } from 'next';
import ContactSupport from '@/features/support/ContactSupport';
export const metadata: Metadata = {title: 'Contact & Support', description: 'Find published Astro Soul Path help and securely manage your Customer support requests.', alternates: {canonical: '/contact'}};
export default function ContactPage() {return <ContactSupport/>;}
