import { Brain } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* IA Symbol */}
      <div className="rounded-md bg-gradient-to-br from-[#C8B88A]/20 to-[#C8B88A]/5 p-2 shadow-[0_0_20px_-8px_#C8B88A]">
        <Brain className="w-4 h-4 text-[#C8B88A]" />
      </div>
      {/* Wordmark */}
      {showText && (
        <span className="text-[20px] font-semibold tracking-tight text-[#C8B88A] drop-shadow-[0_0_12px_rgba(200,184,138,0.25)] hover:opacity-90 transition-opacity duration-200">
          SpeedAI
        </span>
      )}
    </div>
  );
}
