import { useState } from 'react';
import { Castle, Church, Landmark, Mountain, Palette, Snowflake, Sparkles, Trees, Waves, type LucideProps } from 'lucide-react';

const FALLBACKS: [string, React.ComponentType<LucideProps>, string][] = [
  ['aurora', Sparkles, 'aurora'],
  ['winter', Snowflake, 'winter'],
  ['castle', Castle, 'history'],
  ['church', Church, 'history'],
  ['hiking', Mountain, 'nature'],
  ['national_park', Trees, 'nature'],
  ['nature', Trees, 'nature'],
  ['beach', Waves, 'water'],
  ['lake', Waves, 'water'],
  ['coastal', Waves, 'water'],
  ['art', Palette, 'culture'],
  ['museum', Landmark, 'culture'],
];

interface Props {
  src: string | null;
  alt: string;
  tags?: string[];
  className?: string;
  eager?: boolean;
}

/** Image with lazy loading and a themed illustrated fallback when no photo is available or it fails. */
export function PlaceImage({ src, alt, tags = [], className = '', eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    const [, Icon, theme] = FALLBACKS.find(([t]) => tags.includes(t)) ?? ['', Landmark, 'culture'];
    return (
      <div className={`place-img place-img--fallback place-img--${theme} ${className}`} role="img" aria-label={alt}>
        <Icon size={44} strokeWidth={1.4} aria-hidden />
      </div>
    );
  }
  return (
    <div className={`place-img ${loaded ? 'is-loaded' : ''} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
