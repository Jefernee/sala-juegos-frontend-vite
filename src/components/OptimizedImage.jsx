// src/components/OptimizedImage.jsx
import React, { useState, useEffect } from "react";

const OptimizedImage = ({ 
  src, 
  alt = "Imagen", 
  className = "", 
  style = {}, 
  wrapperClass = "",
  wrapperStyle = {},
  loadingHeight = "200px"
}) => {
  const [imageState, setImageState] = useState('loading'); // 'loading', 'loaded', 'error'

  useEffect(() => {
    if (!src) {
      setImageState('error');
      return;
    }

    setImageState('loading');
    const img = new Image();
    
    const handleLoad = () => {
      setImageState('loaded');
    };

    const handleError = () => {
      console.error('Error cargando imagen:', src);
      setImageState('error');
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);
    img.src = src;

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [src]);

  // Error state
  if (imageState === 'error') {
    return (
      <div 
        className={`${wrapperClass} d-flex align-items-center justify-content-center bg-light`}
        style={{ 
          ...wrapperStyle,
          minHeight: style.height || loadingHeight,
          width: style.width || '100%',
          border: '2px dashed #dee2e6',
          borderRadius: style.borderRadius || '8px'
        }}
      >
        <div className="text-center text-muted">
          <i className="bi bi-image" style={{ fontSize: '2rem' }}></i>
          <p className="mt-2 mb-0 small">Error</p>
        </div>
      </div>
    );
  }

  // Con wrapper
  if (wrapperClass || Object.keys(wrapperStyle).length > 0) {
    return (
      <div className={wrapperClass} style={{ position: 'relative', ...wrapperStyle }}>
        {imageState === 'loading' && (
          <div 
            className="d-flex align-items-center justify-content-center bg-light position-absolute top-0 start-0" 
            style={{ 
              width: '100%',
              height: '100%',
              minHeight: loadingHeight,
              borderRadius: style.borderRadius || '8px',
              zIndex: 1
            }}
          >
            <div className="spinner-border spinner-border-sm text-secondary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        )}
        
        <img
          src={src}
          alt={alt}
          className={className}
          style={{ 
            ...style,
            opacity: imageState === 'loaded' ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
          loading="lazy"
        />
      </div>
    );
  }

  // Sin wrapper
  return (
    <>
      {imageState === 'loading' && (
        <div 
          className="d-flex align-items-center justify-content-center bg-light"
          style={{ 
            ...style,
            minHeight: style.height || loadingHeight,
            borderRadius: style.borderRadius || '8px'
          }}
        >
          <div className="spinner-border spinner-border-sm text-secondary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}
      
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ 
          ...style,
          display: imageState === 'loaded' ? (style.display || 'block') : 'none',
          opacity: imageState === 'loaded' ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
        loading="lazy"
      />
    </>
  );
};

export default OptimizedImage;