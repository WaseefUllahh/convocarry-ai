import React, { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import * as htmlToImage from 'html-to-image';
import './screenshot.css';

const ScreenshotLayout: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  const exportImage = async () => {
    if (!ref.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(ref.current, {
        width: 1280,
        height: 800,
        pixelRatio: 1 // Keep exactly 1280x800 regardless of Retina screens
      });
      const link = document.createElement('a');
      link.download = 'screenshot.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. Check console.');
    }
  };

  return (
    <div className="screenshot-app-wrapper">
      <div className="screenshot-toolbar">
        <span>Frame Size: 1280x800</span>
        <button onClick={exportImage} className="export-btn">Export PNG</button>
      </div>
      
      <div className="screenshot-canvas-container">
        <div className="screenshot-frame" ref={ref}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default ScreenshotLayout;
