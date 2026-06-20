import React, { useState, useEffect } from 'react';

interface ChromeStoreCTAProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChromeStoreCTA: React.FC<ChromeStoreCTAProps> = ({ 
  className = 'btn btn-primary', 
  style, 
  children = 'Add to Chrome' 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const storeUrl = import.meta.env.VITE_CHROME_STORE_URL;
  const isPlaceholder = !storeUrl || storeUrl === '#' || storeUrl.includes('placeholder');

  const handleClick = (e: React.MouseEvent) => {
    if (isPlaceholder) {
      e.preventDefault();
      setIsModalOpen(true);
    }
  };

  const copySteps = () => {
    const steps = `1. Open chrome://extensions
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the extension build folder: apps/extension/.output/chrome-mv3
5. Pin ConvoCarry AI from the extensions menu`;
    navigator.clipboard.writeText(steps);
    alert('Install steps copied to clipboard!');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  return (
    <>
      {isPlaceholder ? (
        <button
          className={className}
          style={style}
          onClick={handleClick}
          aria-label={typeof children === 'string' ? children : 'Add to Chrome'}
        >
          <span>{children}</span>
        </button>
      ) : (
        <a 
          href={storeUrl} 
          target="_blank"
          rel="noopener noreferrer"
          className={className} 
          style={style}
          onClick={handleClick}
          aria-label={typeof children === 'string' ? children : 'Add to Chrome'}
        >
          <span>{children}</span>
        </a>
      )}

      {isModalOpen && (
        <div 
          className="modal-overlay" 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 9999, padding: '16px'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="modal-card" 
            style={{
              background: 'rgba(24, 24, 27, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#f4f4f5' }}>
              Install ConvoCarry locally
            </h2>
            <p style={{ color: '#a1a1aa', marginBottom: '24px' }}>
              The Chrome Store link is not configured. Since you are running locally, follow these steps to install the beta extension:
            </p>
            <ol style={{ color: '#d4d4d8', paddingLeft: '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Open <strong>chrome://extensions</strong> in your browser</li>
              <li>Enable <strong>Developer mode</strong> (top right)</li>
              <li>Click <strong>Load unpacked</strong></li>
              <li>Select the build folder:<br/><code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85em' }}>apps/extension/.output/chrome-mv3</code></li>
              <li>Pin ConvoCarry AI from the extensions menu</li>
            </ol>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>
                Got it
              </button>
              <button className="btn btn-secondary" onClick={copySteps} style={{ flex: 1 }}>
                Copy install steps
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
