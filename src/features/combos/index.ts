// Exportaciones principales del módulo de combos

// Componentes
export { CombosPage } from './components/CombosPage';
export { CreateComboModal } from './components/CreateComboModal';
export { EditComboModal } from './components/EditComboModal';

// Hooks
export {
  useCombos,
  useActiveCombos,
  useComboValidation,
  useComboStats,
  useComboUsageLog,
  useProductSearch
} from './hooks/useCombos';

// Servicios
export { CombosService } from './services/combosService';

// Tipos (re-exportados desde core)
export type {
  Combo,
  ComboWithDetails,
  ComboItemDetail,
  ComboUsageLog,
  CreateComboData,
  UpdateComboData,
  ComboValidationResult,
  ComboStats,
  ComboFilters,
  ComboStatus
} from '@/core/types/database';