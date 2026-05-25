import React from 'react';

interface OverdeskLogoProps {
  className?: string;
  size?: number;
}

export const OverdeskLogo: React.FC<OverdeskLogoProps> = ({ className = '', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      id="overdesk-logo-svg"
    >
      <defs>
        {/* Sphere gradient: vibrant sky blue to purple to keep it colorful and dynamic */}
        <linearGradient id="sphereGrad_overdesk_unique" x1="0.15" y1="0.1" x2="0.85" y2="0.9">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>

        {/* Ring gradient: rich colorful violet to indigo to cyan gradient for a spectacular look */}
        <linearGradient id="ringGrad_overdesk_unique" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {/* 1. Back part of the ring (behind the sphere) */}
      <g transform="rotate(-15 50 50)">
        <path
          d="M 6 50 A 44 14 0 0 1 94 50 L 84 50 A 34 10 0 0 0 16 50 Z"
          fill="url(#ringGrad_overdesk_unique)"
        />
      </g>

      {/* 2. Blue Planet Sphere */}
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="url(#sphereGrad_overdesk_unique)"
      />

      {/* 3. Front part of the ring (in front of the sphere) */}
      <g transform="rotate(-15 50 50)">
        <path
          d="M 94 50 A 44 14 0 0 1 6 50 L 16 50 A 34 10 0 0 0 84 50 Z"
          fill="url(#ringGrad_overdesk_unique)"
        />
      </g>
    </svg>
  );
};
