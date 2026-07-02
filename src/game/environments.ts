// Five distinct biomes the arena cycles through as a run goes on. Each pairs
// a visual palette + ambient particle style with its own music theme (see
// music.ts, keyed by the same id). The loop swaps environments every 60-120s
// so a long run doesn't look and sound identical at minute 12 as at minute 1.

export type AmbientKind = 'none' | 'stars' | 'snow' | 'embers' | 'spores'

export interface EnvironmentDef {
  id: string
  name: string
  bg: string
  grid: string
  ambient: AmbientKind
  ambientColor: string
  bannerColor: string
}

export const ENVIRONMENTS: EnvironmentDef[] = [
  {
    id: 'outskirts',
    name: 'CYBER OUTSKIRTS',
    bg: '#07070f',
    grid: 'rgba(80, 100, 255, 0.07)',
    ambient: 'none',
    ambientColor: '#4dd8ff',
    bannerColor: '#4dd8ff',
  },
  {
    id: 'wastes',
    name: 'TOXIC WASTES',
    bg: '#070f08',
    grid: 'rgba(90, 255, 120, 0.06)',
    ambient: 'spores',
    ambientColor: '#7dffb0',
    bannerColor: '#38ffb0',
  },
  {
    id: 'core',
    name: 'MOLTEN CORE',
    bg: '#120705',
    grid: 'rgba(255, 110, 60, 0.07)',
    ambient: 'embers',
    ambientColor: '#ff8a3d',
    bannerColor: '#ff5d3d',
  },
  {
    id: 'frostbyte',
    name: 'FROSTBYTE ZONE',
    bg: '#060a12',
    grid: 'rgba(140, 200, 255, 0.08)',
    ambient: 'snow',
    ambientColor: '#c8ecff',
    bannerColor: '#9ad9ff',
  },
  {
    id: 'void',
    name: 'DEEP VOID',
    bg: '#05040c',
    grid: 'rgba(150, 100, 255, 0.05)',
    ambient: 'stars',
    ambientColor: '#c7a8ff',
    bannerColor: '#b464ff',
  },
]

export const ENV_MIN_DURATION = 60
export const ENV_MAX_DURATION = 120

export function nextEnvIndex(current: number): number {
  return (current + 1) % ENVIRONMENTS.length
}

export function randomEnvDuration(): number {
  return ENV_MIN_DURATION + Math.random() * (ENV_MAX_DURATION - ENV_MIN_DURATION)
}
