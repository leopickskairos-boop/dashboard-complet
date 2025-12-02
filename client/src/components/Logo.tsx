interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-[18px] font-semibold tracking-tight text-[#3A63F3] hover:opacity-90 transition-opacity duration-200">
        SpeedAI
      </span>
    </div>
  );
}
