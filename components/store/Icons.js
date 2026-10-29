// Small line icons for the store (no icon font to download). Each one takes a size and inherits the text colour.
const base = (size) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" });

export const SearchIcon = ({ size = 18 }) => (<svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const ChevronDown = ({ size = 16 }) => (<svg {...base(size)}><path d="m6 9 6 6 6-6" /></svg>);
export const ChevronRight = ({ size = 16 }) => (<svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>);
export const ChevronLeft = ({ size = 16 }) => (<svg {...base(size)}><path d="m15 6-6 6 6 6" /></svg>);
export const PlayIcon = ({ size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>);
export const LockIcon = ({ size = 16 }) => (<svg {...base(size)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
export const CheckIcon = ({ size = 16 }) => (<svg {...base(size)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const StarIcon = ({ size = 16, filled = false }) => (<svg {...base(size)} fill={filled ? "currentColor" : "none"}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z" /></svg>);
export const CloseIcon = ({ size = 18 }) => (<svg {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const StoreIcon = ({ size = 22 }) => (<svg {...base(size)}><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5" /></svg>);
export const LibraryIcon = ({ size = 22 }) => (<svg {...base(size)}><rect x="3.5" y="4" width="5" height="16" rx="1.2" /><rect x="10.5" y="4" width="5" height="16" rx="1.2" /><path d="m17.8 5.2 3.3 14.4" /></svg>);
export const TrophyIcon = ({ size = 22 }) => (<svg {...base(size)}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3" /><path d="M12 13v4M8.5 20h7M10 17h4" /></svg>);
export const UserIcon = ({ size = 22 }) => (<svg {...base(size)}><circle cx="12" cy="8.5" r="3.7" /><path d="M4.8 20c.9-3.6 3.7-5.4 7.2-5.4s6.3 1.8 7.2 5.4" /></svg>);
export const MoreIcon = ({ size = 22 }) => (<svg {...base(size)}><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></svg>);
export const DesktopIcon = ({ size = 16 }) => (<svg {...base(size)}><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8.5 20h7M12 16.5V20" /></svg>);
export const PhoneIcon = ({ size = 16 }) => (<svg {...base(size)}><rect x="7" y="3" width="10" height="18" rx="2.2" /><path d="M11 18h2" /></svg>);
export const CloudIcon = ({ size = 16 }) => (<svg {...base(size)}><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.75 3.75 0 0 1-.5 7.5H7Z" /></svg>);
export const BoltIcon = ({ size = 16 }) => (<svg {...base(size)}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></svg>);
export const FullscreenIcon = ({ size = 18 }) => (<svg {...base(size)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const VolumeIcon = ({ size = 18, off = false }) => (<svg {...base(size)}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />{off ? <path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}</svg>);
export const ArrowRight = ({ size = 16 }) => (<svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const HeartIcon = ({ size = 18, filled = false }) => (<svg {...base(size)} fill={filled ? "currentColor" : "none"}><path d="M12 20.2s-7.5-4.5-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10.1-7.5 10.1Z" /></svg>);
export const ShareIcon = ({ size = 18 }) => (<svg {...base(size)}><circle cx="6" cy="12" r="2.4" /><circle cx="17.5" cy="6" r="2.4" /><circle cx="17.5" cy="18" r="2.4" /><path d="m8.1 10.9 7.3-3.8M8.1 13.1l7.3 3.8" /></svg>);
export const InfoIcon = ({ size = 16 }) => (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>);
