import './globals.css';

export const metadata = {
  title: 'Clinkit — hyperlocal delivery at the lowest store price',
  description: 'Compare live prices across nearby stores; a Runner delivers in 10–60 min.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container wide">
          <header className="topbar">
            <a className="brand" href="/">⚡ Clink<span>it</span></a>
            <span className="zipchip">95376 · Tracy, CA ▾</span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
