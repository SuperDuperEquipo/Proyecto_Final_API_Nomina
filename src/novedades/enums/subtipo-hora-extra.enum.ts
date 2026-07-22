// Cada valor tiene un recargo legal distinto sobre la hora ordinaria
// (Art. 168 CT para ordinaria/descanso, Art. 191 CT para asueto):
// DIURNA 100%, NOCTURNA 150%, DESCANSO_DIURNA 300%, DESCANSO_NOCTURNA 375%,
// ASUETO_DIURNA 400%, ASUETO_NOCTURNA 500%. Verificar contra el texto oficial
// del Código de Trabajo antes de la defensa (cifras tomadas de fuentes
// especializadas, no del articulado literal).
export enum SubtipoHoraExtra {
  DIURNA = 'DIURNA',
  NOCTURNA = 'NOCTURNA',
  DESCANSO_DIURNA = 'DESCANSO_DIURNA',
  DESCANSO_NOCTURNA = 'DESCANSO_NOCTURNA',
  ASUETO_DIURNA = 'ASUETO_DIURNA',
  ASUETO_NOCTURNA = 'ASUETO_NOCTURNA',
}
