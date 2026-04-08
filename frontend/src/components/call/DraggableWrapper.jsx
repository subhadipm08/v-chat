import { useState, useRef, useEffect } from 'react';

export default function DraggableWrapper({ children, className, isDraggable = true }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef(null);

  const handlePointerDown = (e) => {
    if (!isDraggable || !containerRef.current) return;
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };

    const rect = containerRef.current.getBoundingClientRect();
    const baseLeft = rect.left - position.x;
    const baseTop = rect.top - position.y;
    
    boundsRef.current = {
      minX: -baseLeft + 10,
      maxX: window.innerWidth - rect.width - baseLeft - 10,
      minY: -baseTop + 10,
      maxY: window.innerHeight - rect.height - baseTop - 10
    };

    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !isDraggable) return;
    
    let newX = e.clientX - offsetRef.current.x;
    let newY = e.clientY - offsetRef.current.y;
    
    if (boundsRef.current) {
      newX = Math.max(boundsRef.current.minX, Math.min(newX, boundsRef.current.maxX));
      newY = Math.max(boundsRef.current.minY, Math.min(newY, boundsRef.current.maxY));
    }
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (!isDraggable) return;
    setIsDragging(false);
    if (e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  // Reset position natively if the element drops out of drift mode
  useEffect(() => {
    if (!isDraggable) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isDraggable]);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: isDraggable ? `translate(${position.x}px, ${position.y}px)` : 'none',
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        touchAction: isDraggable ? 'none' : 'auto', 
        zIndex: isDraggable ? (isDragging ? 100 : 50) : undefined,
        transition: isDragging ? 'none' : 'transform 0.3s ease', /* smooth reset constraint */
      }}
    >
      {children}
    </div>
  );
}
