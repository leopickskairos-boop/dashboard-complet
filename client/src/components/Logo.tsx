interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      {/* Wordmark with micro gold shimmer - NO icon */}
      {showText && (
        <span className="relative text-[18px] font-semibold tracking-tight text-white/90 after:absolute after:top-1/2 after:-translate-y-1/2 after:left-0 after:w-[60px] after:h-[20px] after:bg-[#C8B88A]/10 after:blur-[20px] after:opacity-20 after:-z-10">
          SpeedAI
        </span>
      )}
    </div>
  );
}
