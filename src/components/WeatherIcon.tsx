import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun, type LucideProps } from 'lucide-react';
import { describeWeatherCode, type WeatherKind } from '../lib/weather';

const ICONS: Record<WeatherKind, React.ComponentType<LucideProps>> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
};

export function WeatherIcon({ code, size = 20, ...rest }: { code: number } & LucideProps) {
  const { kind, label } = describeWeatherCode(code);
  const Icon = ICONS[kind];
  return <Icon size={size} aria-label={label} className={`wx-icon wx-${kind}`} {...rest} />;
}
