import React, { useState } from 'react';

const FEATURES = [
  {
    title: "Know your body",
    description: "Experience smart cycle prediction, detailed symptom logging, and personal health insights.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCAfA5tUuPRsBimaM98TE_nyQphnhdwmlVPuqhh5FhEKU5x2_Z3nAD8A2d3Z0-HQZMvMRYAQ17PZc_idtf7LKHMZBeNGRLPQQgBw8Frh8tHG4klWr5BENNalYVqojkmaq-5QbhzXmau-YUIB6tXtOHmV2WU7Czb0iR5YrGPePBul4YKODbUzqfuXaZvUlelyYfMwfebqr7EilW2ukcvFSWicn6oFAnbUpAA_Qg0T-Kdp5sJPmT7QPEUCpE1u5Fo5vZVnKjfDGGuGCI",
    tags: ["Prediction", "Logging"],
    icon: "all_inclusive",
    accent: "primary",
    gradient: "from-[#984369] via-[#be185d] to-[#4a1c31]" // Pink/Red
  },
  {
    title: "Track Symptoms",
    description: "Log your daily mood, flow, and physical symptoms to understand your unique patterns.",
    image: "https://images.unsplash.com/photo-1516575334481-f85287c2c81d?auto=format&fit=crop&q=80&w=1000",
    tags: ["Health", "Self-care"],
    icon: "edit_note",
    accent: "#4ECDC4",
    gradient: "from-[#2E8B83] via-[#4ECDC4] to-[#1a524c]" // Green/Teal
  },
  {
    title: "Smart Insights",
    description: "Get personalized health reports and predictions based on your cycle history.",
    // Using a valid image URL (placeholder or specific asset)
    image: "https://images.unsplash.com/photo-1576091160550-2187d80a1844?auto=format&fit=crop&q=80&w=1000",
    tags: ["Analysis", "Reports"],
    icon: "insights",
    accent: "#FFB74D",
    gradient: "from-[#E65100] via-[#FFB74D] to-[#BF360C]" // Orange
  }
];

export const FeatureCarousel: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const feature = FEATURES[current];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
       {/* Card Container */}
      <div className="relative w-full h-[clamp(110px,22dvh,210px)] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10 group bg-surface-dark transition-all duration-700">

        {/* Animated Background Gradients (Replaces Images) */}
        {FEATURES.map((item, index) => (
             <div
                key={index}
                className={`absolute inset-0 bg-gradient-to-br ${item.gradient} transition-opacity duration-1000 ${index === current ? 'opacity-100' : 'opacity-0'}`}
            >
                {/* Subtle Image Overlay */}
                <div
                    className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-20"
                    style={{ backgroundImage: `url("${item.image}")` }}
                />

                {/* Glossy Effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/30"></div>

                {/* Decorative Blur Circles */}
                <div className="absolute top-[-50%] right-[-50%] w-full h-full bg-white/10 rounded-full blur-[80px]"></div>
                <div className="absolute bottom-[-50%] left-[-50%] w-full h-full bg-black/20 rounded-full blur-[80px]"></div>
            </div>
        ))}

        {/* Dynamic Icon Badge */}
        <div className={`absolute top-6 right-6 bg-white/10 backdrop-blur-md p-3 rounded-2xl ring-1 ring-white/20 shadow-lg transition-transform duration-500 hover:scale-110 z-10`}>
          <span
            className="material-symbols-outlined text-2xl text-white drop-shadow-md"
          >
            {feature.icon}
          </span>
        </div>
      </div>

      {/* Text Content */}
      <div className="flex flex-col items-center text-center gap-4 animate-fadeIn">
        <h1 className="text-white tracking-tight text-[28px] font-bold leading-[1.15] drop-shadow-sm transition-all duration-500 min-h-[40px] flex items-end justify-center">
          {feature.title}
        </h1>
        <p className="text-white/60 text-[15px] font-normal leading-relaxed min-h-[60px]">
          {feature.description}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-2">
            {feature.tags.map(tag => (
              <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/10">
                <span className="material-symbols-outlined text-[16px]" style={{ color: feature.accent === 'primary' ? '#D14D72' : feature.accent }}>check_circle</span>
                {tag}
              </div>
            ))}
        </div>
      </div>

      {/* Dots / Progress Bars */}
      <div className="flex w-full flex-row items-center justify-center gap-3 pt-2">
        {FEATURES.map((item,index) => (
          <button key={item.title} type="button" aria-label={'Show '+item.title} aria-pressed={index===current}
            onClick={()=>setCurrent(index)} className="p-2 rounded-full">
            <span className={'block h-2 rounded-full '+(index===current?'w-10 bg-primary':'w-2 bg-white/30')} />
          </button>
        ))}
      </div>
    </div>
  );
};
