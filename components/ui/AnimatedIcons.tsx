import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation, useReducedMotion, Variants, HTMLMotionProps } from 'framer-motion';

// --- Helper for class names since lib/utils doesn't exist ---
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- DashboardIcon (User Provided Code) ---
export interface DashboardIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface DashboardIconProps extends HTMLMotionProps<"div"> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
  isActive?: boolean; // Added for compatibility with existing AnimatedIcons usage
}

const DashboardIcon = forwardRef<DashboardIconHandle, DashboardIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 0.6,
      isAnimated = true,
      isActive, // Use this prop to trigger animation
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    // Trigger animation based on isActive prop
    React.useEffect(() => {
      if (isActive) {
        if (reduced) {
          controls.start("normal");
        } else {
          controls.start("animate");
        }
      } else {
        controls.start("normal");
      }
    }, [isActive, controls, reduced]);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as any);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e as any);
      },
      [controls, onMouseLeave],
    );

    const iconVariants: Variants = {
      normal: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 1.06, 0.98, 1],
        rotate: [0, -1.5, 1.5, 0],
        transition: { duration: 1.1 * duration, ease: "easeInOut" as const },
      },
    };

    const tileVariants: Variants = {
      normal: { opacity: 1, scale: 1, y: 0 },
      animate: (i: number) => ({
        opacity: [0.6, 1],
        scale: [0.95, 1.04, 1],
        y: [3, -2, 0],
        transition: {
          duration: 0.9 * duration,
          ease: "easeInOut" as const,
          delay: i * 0.08,
        },
      }),
    };

    return (
      <motion.div
        className={cn("inline-flex items-center justify-center", className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        {...props}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={controls}
          initial="normal"
          variants={iconVariants}
        >
          <motion.rect
            width="7"
            height="9"
            x="3"
            y="3"
            rx="1"
            variants={tileVariants}
            custom={0}
          />
          <motion.rect
            width="7"
            height="5"
            x="14"
            y="3"
            rx="1"
            variants={tileVariants}
            custom={1}
          />
          <motion.rect
            width="7"
            height="9"
            x="14"
            y="12"
            rx="1"
            variants={tileVariants}
            custom={2}
          />
          <motion.rect
            width="7"
            height="5"
            x="3"
            y="16"
            rx="1"
            variants={tileVariants}
            custom={3}
          />
        </motion.svg>
      </motion.div>
    );
  }
);

DashboardIcon.displayName = "DashboardIcon";

// --- Other Icons (Maintaining existing implementations) ---

// ChartLine (Insights)
const chartAnimations = {
  normal: {
    path2: { opacity: 1, pathLength: 1, pathOffset: 0 },
  },
  animate: {
    path2: {
      opacity: [0, 1],
      pathLength: [0, 1],
      pathOffset: [1, 0],
      transition: {
        duration: 0.8,
        ease: 'easeInOut' as const,
        opacity: { duration: 0.01 },
      },
    },
  },
};

const userAnimations = {
  normal: {
    path: { y: 0 },
    circle: { y: 0 },
  },
  animate: {
    path: {
      y: [0, 4, -2, 0],
      transition: {
        duration: 0.6,
        ease: 'easeInOut' as const,
      },
    },
    circle: {
      y: [0, 1, -2, 0],
      transition: {
        duration: 0.6,
        ease: 'easeInOut' as const,
      },
    },
  },
};

const calendarVariants: Variants = {
  normal: {
    rotate: 0,
    scale: 1,
    y: 0
  },
  animate: {
    rotate: [0, -10, 10, -5, 5, 0],
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut" as const,
      times: [0, 0.2, 0.4, 0.6, 0.8, 1]
    }
  }
};

interface IconProps {
  isActive?: boolean;
  className?: string;
}

export const AnimatedDashboard = DashboardIcon; // Export as AnimatedDashboard for compatibility

export const AnimatedInsights: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
    >
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <motion.path
        d="m19 9-5 5-4-4-3 3"
        variants={{ normal: chartAnimations.normal.path2, animate: chartAnimations.animate.path2 }}
      />
    </motion.svg>
  );
};

export const AnimatedProfile: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
    >
      <motion.path
        d="M20 21a8 8 0 0 0-16 0"
        variants={{ normal: userAnimations.normal.path, animate: userAnimations.animate.path }}
      />
      <motion.circle
        cx={12} cy={8} r={5}
        variants={{ normal: userAnimations.normal.circle, animate: userAnimations.animate.circle }}
      />
    </motion.svg>
  );
};

export const CustomAnimatedCalendar: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
      variants={calendarVariants}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />

      <motion.circle
        cx="12" cy="16" r="2" fill="currentColor"
        animate={isActive ? { scale: [1, 1.5, 1] } : { scale: 1 }}
        transition={{ duration: 0.4 }}
      />
    </motion.svg>
  );
};

const heartVariants: Variants = {
  normal: {
    scale: 1,
    fill: "none",
    stroke: "currentColor"
  },
  animate: {
    scale: [1, 1.2, 1],
    fill: ["rgba(236, 72, 153, 0)", "rgba(236, 72, 153, 1)", "rgba(236, 72, 153, 0)"],
    stroke: ["rgb(236, 72, 153)", "rgb(236, 72, 153)", "rgb(236, 72, 153)"], // Fixed: removed currentColor
    transition: {
      duration: 0.8,
      ease: "easeInOut" as const,
      repeat: 0
    }
  }
};

export const AnimatedHeart: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
      variants={heartVariants}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </motion.svg>
  );
};

// ==================== ADMIN NAVBAR ICONS ====================

// Animated Users/Group Icon
const usersGroupVariants: Variants = {
  normal: { scale: 1 },
  animate: {
    scale: [1, 1.1, 1],
    transition: { duration: 0.4, ease: "easeInOut" as const }
  }
};

const userBounceVariants: Variants = {
  normal: { y: 0, opacity: 1 },
  animate: (i: number) => ({
    y: [0, -3, 0],
    opacity: [0.7, 1, 1],
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
      delay: i * 0.1
    }
  })
};

export const AnimatedUsersIcon: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ overflow: 'visible' }}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
      variants={usersGroupVariants}
    >
      {/* First user */}
      <motion.circle
        cx="9" cy="7" r="4"
        variants={userBounceVariants}
        custom={0}
      />
      <motion.path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        variants={userBounceVariants}
        custom={1}
      />
      {/* Second user (offset) */}
      <motion.path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        variants={userBounceVariants}
        custom={2}
      />
      <motion.path
        d="M21 21v-2a4 4 0 0 0-3-3.85"
        variants={userBounceVariants}
        custom={3}
      />
    </motion.svg>
  );
};

// Animated Love Notes / Heart Document Icon
const noteHeartVariants: Variants = {
  normal: { scale: 1, rotate: 0 },
  animate: {
    scale: [1, 1.05, 1],
    rotate: [0, -2, 2, 0],
    transition: { duration: 0.5, ease: "easeInOut" as const }
  }
};

const heartPulseVariants: Variants = {
  normal: { scale: 1, fill: "none" },
  animate: {
    scale: [1, 1.15, 1],
    fill: ["rgba(236, 72, 153, 0)", "rgba(236, 72, 153, 0.8)", "rgba(236, 72, 153, 0)"],
    transition: {
      duration: 0.6,
      ease: "easeInOut" as const,
      repeat: 1
    }
  }
};

export const AnimatedLoveNotesIcon: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ overflow: 'visible' }}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
      variants={noteHeartVariants}
    >
      {/* Heart shape */}
      <motion.path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        variants={heartPulseVariants}
      />
    </motion.svg>
  );
};

// Animated Logs / List Icon
const listItemVariants: Variants = {
  normal: { x: 0, opacity: 1 },
  animate: (i: number) => ({
    x: [0, 3, 0],
    opacity: [0.5, 1, 1],
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
      delay: i * 0.08
    }
  })
};

export const AnimatedLogsIcon: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
    >
      {/* Document outline */}
      <motion.rect
        x="3" y="3" width="18" height="18" rx="2"
        variants={{
          normal: { scale: 1 },
          animate: { scale: [1, 1.02, 1], transition: { duration: 0.3 } }
        }}
      />
      {/* List lines */}
      <motion.line x1="7" y1="8" x2="17" y2="8" variants={listItemVariants} custom={0} />
      <motion.line x1="7" y1="12" x2="17" y2="12" variants={listItemVariants} custom={1} />
      <motion.line x1="7" y1="16" x2="13" y2="16" variants={listItemVariants} custom={2} />
    </motion.svg>
  );
};

// Animated Profile / Settings Icon
const gearVariants: Variants = {
  normal: { rotate: 0, scale: 1 },
  animate: {
    rotate: [0, 180],
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut" as const
    }
  }
};

export const AnimatedProfileIcon: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
    >
      {/* Head */}
      <motion.circle
        cx="12" cy="8" r="5"
        variants={{
          normal: { y: 0 },
          animate: { y: [0, -2, 0], transition: { duration: 0.4 } }
        }}
      />
      {/* Body */}
      <motion.path
        d="M20 21a8 8 0 0 0-16 0"
        variants={{
          normal: { y: 0 },
          animate: { y: [0, 2, 0], transition: { duration: 0.4, delay: 0.1 } }
        }}
      />
    </motion.svg>
  );
};

// Animated Sun Icon (for theme toggle)
const sunRayVariants: Variants = {
  normal: { rotate: 0, scale: 1 },
  animate: {
    rotate: [0, 45],
    scale: [1, 1.1, 1],
    transition: { duration: 0.5, ease: "easeInOut" as const }
  }
};

export const AnimatedSunIcon: React.FC<IconProps & { size?: number }> = ({ isActive, className, size = 20 }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
      variants={sunRayVariants}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </motion.svg>
  );
};

// Animated Moon Icon (for theme toggle)
const moonVariants: Variants = {
  normal: { rotate: 0, scale: 1 },
  animate: {
    rotate: [0, -20, 0],
    scale: [1, 1.15, 1],
    transition: { duration: 0.5, ease: "easeInOut" as const }
  }
};

export const AnimatedMoonIcon: React.FC<IconProps & { size?: number }> = ({ isActive, className, size = 20 }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="normal"
      animate={isActive ? "animate" : "normal"}
      variants={moonVariants}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </motion.svg>
  );
};

// Animated Refresh Icon
export const AnimatedRefreshIcon: React.FC<IconProps & { size?: number }> = ({ isActive, className, size = 20 }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={isActive ? { rotate: 360 } : { rotate: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" as const }}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </motion.svg>
  );
};

// Animated Logout Icon
export const AnimatedLogoutIcon: React.FC<IconProps & { size?: number }> = ({ isActive, className, size = 20 }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ x: 0 }}
      animate={isActive ? { x: [0, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </motion.svg>
  );
};

export const AnimatedGamesIcon: React.FC<IconProps> = ({ isActive, className }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={isActive ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Gamepad body */}
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </motion.svg>
  );
};

// Animated Wellness / Pie Chart Icon (User Provided)
const chartPieVariants: Variants = {
  normal: {
    scale: 1,
    rotate: 0,
    transition: { duration: 0.2 },
  },
  animate: {
    scale: [1, 1.05, 1],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 0.8,
      ease: "easeInOut" as const,
    },
  },
};

const piePathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.2 },
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0.7, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut" as const,
    },
  },
};

export const AnimatedWellnessIcon: React.FC<IconProps> = ({ isActive, className }) => {
  const controls = useAnimation();
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (isActive) {
      if (reduced) {
        controls.start("normal");
      } else {
        controls.start("animate");
      }
    } else {
      controls.start("normal");
    }
  }, [isActive, controls, reduced]);

  return (
    <motion.div
      className={cn("inline-flex items-center justify-center", className)}
      initial="normal"
      animate={controls}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={chartPieVariants}
      >
        <motion.path
          d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"
          variants={piePathVariants}
        />
        <motion.path d="M21.21 15.89A10 10 0 1 1 8 2.83" variants={piePathVariants} />
      </motion.svg>
    </motion.div>
  );
};

// --- HouseIcon (User Provided Code) ---
export interface HouseHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HouseProps extends HTMLMotionProps<"div"> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
  isActive?: boolean;
}

export const AnimatedHomeIcon = forwardRef<HouseHandle, HouseProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      isActive,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    // Trigger animation based on isActive prop for compatibility
    React.useEffect(() => {
      if (isActive) {
        if (reduced) controls.start("normal");
        else controls.start("animate");
      } else {
        controls.start("normal");
      }
    }, [isActive, controls, reduced]);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as any);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e as any);
      },
      [controls, onMouseLeave],
    );

    const baseVariants: Variants = {
      normal: { opacity: 1 },
      animate: {
        opacity: 0.65,
        transition: {
          duration: 0.2 * duration,
          ease: "easeOut" as const,
        },
      },
    };

    const doorVariants: Variants = {
      normal: { opacity: 1 },
      animate: {
        opacity: [1, 0.4, 1],
        transition: {
          duration: 0.35 * duration,
          ease: "easeInOut" as const,
        },
      },
    };

    return (
      <motion.div
        className={cn("inline-flex items-center justify-center", className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        {...props}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={controls}
          initial="normal"
        >
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10" />
          <motion.path
            d="M21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9"
            variants={baseVariants}
          />
          <motion.path
            d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
            variants={doorVariants}
          />
        </motion.svg>
      </motion.div>
    );
  },
);
AnimatedHomeIcon.displayName = 'AnimatedHomeIcon';

// --- BellIcon (User Provided Code) ---
export interface BellIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BellIconProps extends HTMLMotionProps<"div"> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
}

export const BellIcon = forwardRef<BellIconHandle, BellIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as any);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) {
          controls.start("normal");
        } else {
          onMouseLeave?.(e as any);
        }
      },
      [controls, onMouseLeave],
    );

    const bellVariants: Variants = {
      normal: { rotate: 0 },
      animate: {
        rotate: [0, -18, 15, -10, 6, -3, 0],
        transition: {
          duration: 1.6 * duration,
          repeat: 0,
          ease: "easeInOut" as const,
        },
      },
    };

    const clapperVariants: Variants = {
      normal: { x: 0 },
      animate: {
        x: [0, -4, 4, -2, 2, 0],
        transition: {
          duration: 1.6 * duration,
          repeat: 0,
          ease: "easeInOut" as const,
        },
      },
    };

    return (
      <motion.div
        className={cn("relative inline-flex", className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        {...props}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={controls}
          initial="normal"
          variants={bellVariants}
        >
          <motion.path d="M10.268 21a2 2 0 0 0 3.464 0" variants={clapperVariants} />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </motion.svg>
      </motion.div>
    );
  },
);

BellIcon.displayName = "BellIcon";

// --- ShareIcon (User Provided Code) ---
export interface ShareIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ShareIconProps extends HTMLMotionProps<"div"> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
}

export const ShareIcon = forwardRef<ShareIconHandle, ShareIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as any);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e as any);
      },
      [controls, onMouseLeave],
    );

    const nodeVariants = (delay: number): Variants => ({
      normal: {
        scale: 1,
        opacity: 1,
      },
      animate: {
        scale: [1, 1.15, 1],
        opacity: [0.7, 1],
        transition: {
          duration: 0.45 * duration,
          ease: [0.22, 1, 0.36, 1],
          delay,
        },
      },
    });

    const lineVariants: Variants = {
      normal: {
        opacity: 1,
      },
      animate: {
        opacity: [0.4, 1],
        transition: {
          duration: 0.6 * duration,
          ease: "easeInOut" as const,
        },
      },
    };

    return (
      <motion.div
        className={cn("inline-flex items-center justify-center", className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        {...props}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={controls}
          initial="normal"
        >
          <motion.circle cx="18" cy="5" r="3" variants={nodeVariants(0)} />
          <motion.circle cx="6" cy="12" r="3" variants={nodeVariants(0.12)} />
          <motion.circle cx="18" cy="19" r="3" variants={nodeVariants(0.24)} />

          <motion.line
            x1="8.59"
            y1="13.51"
            x2="15.42"
            y2="17.49"
            variants={lineVariants}
          />
          <motion.line
            x1="15.41"
            y1="6.51"
            x2="8.59"
            y2="10.49"
            variants={lineVariants}
          />
        </motion.svg>
      </motion.div>
    );
  },
);

ShareIcon.displayName = "ShareIcon";
