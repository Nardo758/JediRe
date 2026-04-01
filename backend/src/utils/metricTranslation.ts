export const METRIC_ID_TRANSLATE: Record<string, string> = {
  SFR_HOME_VALUE: 'home_value_index',
  HOME_VALUE: 'home_value_index',
  ZHVI: 'home_value_index',
  ZHVI_ALL: 'home_value_index',
  HOME_VALUE_YOY: 'home_value_index_yoy',
  ZHVI_YOY: 'home_value_index_yoy',
  SFR_HOME_VALUE_GROWTH: 'home_value_index_yoy',
  RENT: 'rent_index',
  SFR_RENT: 'rent_index',
  ZORI: 'rent_index',
  RENT_INDEX: 'rent_index',
  ZORI_YOY: 'rent_index_yoy',
  RENT_YOY: 'rent_index_yoy',
  RENT_INDEX_YOY: 'rent_index_yoy',
  C_SURGE_INDEX: 'home_value_index_yoy',
  C_TRAFFIC_GROWTH_INDEX: 'home_value_index_yoy',
  C_SEARCH_GROWTH_INDEX: 'rent_index_yoy',
  F_RENT_GROWTH: 'rent_index_yoy',
  F_CAP_RATE: 'home_value_index',
  F_RENT_TO_INCOME: 'rent_index',
  D_SEARCH_MOMENTUM: 'rent_index_yoy',
  D_DIGITAL_SCORE: 'rent_index',
  T_PHYSICAL_SCORE: 'home_value_index',
  S_PIPELINE_TO_STOCK: 'home_value_index_yoy',
  S_PERMIT_VELOCITY: 'home_value_index_yoy',
  S_PIPELINE_UNITS: 'home_value_index',
  E_EMPLOYMENT_GROWTH: 'rent_index_yoy',
  E_WAGE_GROWTH: 'rent_index_yoy',
  E_POPULATION_GROWTH: 'home_value_index_yoy',
  M_VACANCY: 'home_value_index',
  M_ABSORPTION: 'home_value_index_yoy',
  O_DEBT_MATURITY_MO: 'home_value_index',
  DEMO_NET_MIGRATION: 'home_value_index_yoy',
  HM_DISTRESS_SCORE: 'home_value_index_yoy',
};

export const OUTCOME_METRICS_DB = ['rent_index_yoy', 'home_value_index_yoy', 'home_value_index', 'rent_index'];

export function translateMetricId(raw: string): string {
  if (!raw) return raw;
  return METRIC_ID_TRANSLATE[raw.toUpperCase()] ?? METRIC_ID_TRANSLATE[raw] ?? raw.toLowerCase();
}
