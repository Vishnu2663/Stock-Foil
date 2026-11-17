/** Small line icons for the buttons on this page (same drawing style as the navigation). */
export function BtnIcon({ name }: { name: 'image' | 'images' | 'camera' | 'moon' | 'frame' | 'angle' | 'bulb' }) {
  const g = {
    image: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" /></>,
    images: <><rect x="6.5" y="7.5" width="14" height="11.5" rx="2.2" /><path d="M3.5 15.5V7a2.5 2.5 0 0 1 2.5-2.5h9" /><circle cx="11" cy="12" r="1.3" /><path d="M7 18l4-3.5 2.5 2 2.5-2 3 3" /></>,
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
    frame: <><path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
    angle: <><path d="M4 19h16" /><path d="M4 19L14 7" /><path d="M9 19a5 5 0 0 0-1.4-3.4" /></>,
    bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></>,
    camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6h6.4L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.3" r="3.2" /></>,
  }[name];
  return <svg className="btn-ico" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{g}</svg>;
}
