import { t } from '../../../../i18n';

export function transformDosha(data: any, lang: string) {
  const res = data?.response || {};

  const score = res?.score ?? 0;
  const isManglik = res?.is_dosha_present ?? false;
  const isAnshik = res?.is_anshik ?? false;

  let severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  if (!isManglik) severity = 'NONE';
  else if (score >= 70) severity = 'HIGH';
  else if (score >= 40) severity = 'MEDIUM';

  return {
    type: 'MANGAL_DOSHA',

    isManglik,
    isAnshik,
    score,
    severity,

    conclusion: t(lang, `dosha.${severity}`),

    factors: res?.factors || {},
  };
}
