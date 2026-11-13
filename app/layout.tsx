import type {ReactNode} from 'react';
import './globals.css';
import NotificationBell from '@/components/notification-bell';
export const metadata={title:'HUB Digital Cambuí | Gestão & Inovação',description:'Conexões, negócios, capacitação e inovação.'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="pt-BR"><body>{children}<NotificationBell/></body></html>}
