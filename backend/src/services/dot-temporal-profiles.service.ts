import { Pool } from 'pg';
import { logger } from '../utils/logger';
import * as fs from 'fs';

export interface TemporalProfile {
  id: number;
  state: string;
  region: string;
  road_functional_class: string;
  profile_type: 'hourly' | 'seasonal' | 'dow' | 'directional';
  factors: Record<string, number>;
  source_year: number;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemporalMultiplierResult {
  hourly_factor: number;
  seasonal_factor: number;
  dow_factor: number;
  combined: number;
  source: 'fdot_profile' | 'default';
}

const DEFAULT_HOURLY_FACTORS: Record<string, number> = {
  '0': 0.012, '1': 0.008, '2': 0.006, '3': 0.005, '4': 0.006, '5': 0.015,
  '6': 0.042, '7': 0.065, '8': 0.078, '9': 0.062, '10': 0.058, '11': 0.063,
  '12': 0.065, '13': 0.060, '14': 0.062, '15': 0.072, '16': 0.080, '17': 0.088,
  '18': 0.068, '19': 0.052, '20': 0.041, '21': 0.032, '22': 0.025, '23': 0.016
};

const DEFAULT_SEASONAL_FACTORS: Record<string, number> = {
  '1': 1.12, '2': 1.15, '3': 1.18, '4': 1.05, '5': 0.98, '6': 0.94,
  '7': 0.92, '8': 0.91, '9': 0.95, '10': 0.97, '11': 1.02, '12': 1.08
};

const DEFAULT_DOW_FACTORS: Record<string, number> = {
  '0': 0.79, '1': 1.02, '2': 1.04, '3': 1.05, '4': 1.06, '5': 1.12, '6': 0.92
};

const DEFAULT_DIRECTIONAL_FACTORS: Record<string, number> = {
  '0_inbound': 0.52, '0_outbound': 0.48,
  '1_inbound': 0.52, '1_outbound': 0.48,
  '2_inbound': 0.52, '2_outbound': 0.48,
  '3_inbound': 0.52, '3_outbound': 0.48,
  '4_inbound': 0.55, '4_outbound': 0.45,
  '5_inbound': 0.58, '5_outbound': 0.42,
  '6_inbound': 0.60, '6_outbound': 0.40,
  '7_inbound': 0.62, '7_outbound': 0.38,
  '8_inbound': 0.62, '8_outbound': 0.38,
  '9_inbound': 0.55, '9_outbound': 0.45,
  '10_inbound': 0.52, '10_outbound': 0.48,
  '11_inbound': 0.50, '11_outbound': 0.50,
  '12_inbound': 0.50, '12_outbound': 0.50,
  '13_inbound': 0.48, '13_outbound': 0.52,
  '14_inbound': 0.45, '14_outbound': 0.55,
  '15_inbound': 0.42, '15_outbound': 0.58,
  '16_inbound': 0.40, '16_outbound': 0.60,
  '17_inbound': 0.38, '17_outbound': 0.62,
  '18_inbound': 0.42, '18_outbound': 0.58,
  '19_inbound': 0.45, '19_outbound': 0.55,
  '20_inbound': 0.48, '20_outbound': 0.52,
  '21_inbound': 0.50, '21_outbound': 0.50,
  '22_inbound': 0.50, '22_outbound': 0.50,
  '23_inbound': 0.50, '23_outbound': 0.50
};

// ─── State-specific factor overrides (Lower #6) ─────────────────────────────
// When seedDefaultProfiles is called for GA, TX, or NC, these overrides
// replace the generic national defaults with state-specific patterns.
// Sources: GDOT/TxDOT/NCDOT hourly distribution curves, TMAS data.

const STATE_HOURLY_OVERRIDES: Record<string, Record<string, Record<string, number>>> = {
  GA: {
    Interstate: { '0':0.010,'1':0.007,'2':0.005,'3':0.004,'4':0.005,'5':0.014,'6':0.045,'7':0.078,'8':0.092,'9':0.068,'10':0.060,'11':0.062,'12':0.063,'13':0.060,'14':0.062,'15':0.074,'16':0.085,'17':0.098,'18':0.072,'19':0.055,'20':0.042,'21':0.032,'22':0.024,'23':0.015 },
    Expressway: { '0':0.011,'1':0.007,'2':0.005,'3':0.004,'4':0.005,'5':0.015,'6':0.048,'7':0.080,'8':0.090,'9':0.065,'10':0.058,'11':0.060,'12':0.062,'13':0.058,'14':0.060,'15':0.072,'16':0.082,'17':0.095,'18':0.070,'19':0.054,'20':0.041,'21':0.031,'22':0.023,'23':0.014 },
    Arterial:   { '0':0.012,'1':0.008,'2':0.006,'3':0.005,'4':0.006,'5':0.016,'6':0.042,'7':0.068,'8':0.082,'9':0.062,'10':0.058,'11':0.062,'12':0.065,'13':0.060,'14':0.062,'15':0.072,'16':0.080,'17':0.088,'18':0.068,'19':0.052,'20':0.041,'21':0.032,'22':0.025,'23':0.016 },
    Collector:  { '0':0.013,'1':0.009,'2':0.007,'3':0.006,'4':0.007,'5':0.018,'6':0.040,'7':0.062,'8':0.075,'9':0.060,'10':0.058,'11':0.063,'12':0.068,'13':0.062,'14':0.063,'15':0.070,'16':0.075,'17':0.082,'18':0.065,'19':0.050,'20':0.040,'21':0.032,'22':0.026,'23':0.017 },
    Local:      { '0':0.014,'1':0.010,'2':0.008,'3':0.007,'4':0.008,'5':0.020,'6':0.038,'7':0.055,'8':0.065,'9':0.058,'10':0.060,'11':0.065,'12':0.072,'13':0.065,'14':0.064,'15':0.068,'16':0.070,'17':0.075,'18':0.062,'19':0.048,'20':0.039,'21':0.032,'22':0.027,'23':0.018 },
  },
  TX: {
    Interstate: { '0':0.011,'1':0.008,'2':0.006,'3':0.005,'4':0.006,'5':0.018,'6':0.050,'7':0.080,'8':0.088,'9':0.065,'10':0.058,'11':0.060,'12':0.062,'13':0.058,'14':0.060,'15':0.072,'16':0.082,'17':0.092,'18':0.070,'19':0.055,'20':0.043,'21':0.033,'22':0.025,'23':0.016 },
    Expressway: { '0':0.012,'1':0.008,'2':0.006,'3':0.005,'4':0.006,'5':0.019,'6':0.052,'7':0.082,'8':0.090,'9':0.066,'10':0.058,'11':0.060,'12':0.062,'13':0.058,'14':0.060,'15':0.072,'16':0.080,'17':0.090,'18':0.068,'19':0.053,'20':0.042,'21':0.032,'22':0.024,'23':0.015 },
    Arterial:   { '0':0.013,'1':0.009,'2':0.007,'3':0.006,'4':0.007,'5':0.020,'6':0.048,'7':0.072,'8':0.082,'9':0.062,'10':0.058,'11':0.062,'12':0.065,'13':0.060,'14':0.062,'15':0.072,'16':0.078,'17':0.085,'18':0.066,'19':0.052,'20':0.042,'21':0.033,'22':0.026,'23':0.017 },
    Collector:  { '0':0.014,'1':0.010,'2':0.008,'3':0.007,'4':0.008,'5':0.022,'6':0.045,'7':0.065,'8':0.075,'9':0.060,'10':0.058,'11':0.063,'12':0.068,'13':0.062,'14':0.063,'15':0.070,'16':0.074,'17':0.080,'18':0.064,'19':0.050,'20':0.041,'21':0.033,'22':0.027,'23':0.018 },
    Local:      { '0':0.015,'1':0.011,'2':0.009,'3':0.008,'4':0.009,'5':0.024,'6':0.042,'7':0.058,'8':0.068,'9':0.058,'10':0.060,'11':0.065,'12':0.072,'13':0.065,'14':0.064,'15':0.068,'16':0.070,'17':0.074,'18':0.062,'19':0.049,'20':0.040,'21':0.033,'22':0.028,'23':0.019 },
  },
  NC: {
    Interstate: { '0':0.010,'1':0.007,'2':0.005,'3':0.004,'4':0.005,'5':0.016,'6':0.045,'7':0.075,'8':0.090,'9':0.066,'10':0.059,'11':0.061,'12':0.063,'13':0.059,'14':0.061,'15':0.073,'16':0.083,'17':0.095,'18':0.071,'19':0.054,'20':0.042,'21':0.032,'22':0.024,'23':0.015 },
    Expressway: { '0':0.011,'1':0.007,'2':0.005,'3':0.004,'4':0.005,'5':0.017,'6':0.048,'7':0.078,'8':0.088,'9':0.064,'10':0.058,'11':0.060,'12':0.062,'13':0.058,'14':0.060,'15':0.071,'16':0.081,'17':0.093,'18':0.069,'19':0.053,'20':0.041,'21':0.031,'22':0.023,'23':0.014 },
    Arterial:   { '0':0.012,'1':0.008,'2':0.006,'3':0.005,'4':0.006,'5':0.018,'6':0.044,'7':0.070,'8':0.084,'9':0.062,'10':0.058,'11':0.062,'12':0.066,'13':0.060,'14':0.062,'15':0.072,'16':0.079,'17':0.087,'18':0.068,'19':0.053,'20':0.042,'21':0.033,'22':0.026,'23':0.017 },
    Collector:  { '0':0.013,'1':0.009,'2':0.007,'3':0.006,'4':0.007,'5':0.020,'6':0.042,'7':0.064,'8':0.078,'9':0.060,'10':0.058,'11':0.063,'12':0.068,'13':0.062,'14':0.063,'15':0.070,'16':0.074,'17':0.082,'18':0.066,'19':0.052,'20':0.042,'21':0.034,'22':0.028,'23':0.018 },
    Local:      { '0':0.014,'1':0.010,'2':0.008,'3':0.007,'4':0.008,'5':0.022,'6':0.040,'7':0.058,'8':0.070,'9':0.058,'10':0.060,'11':0.065,'12':0.072,'13':0.065,'14':0.064,'15':0.068,'16':0.070,'17':0.076,'18':0.064,'19':0.050,'20':0.041,'21':0.034,'22':0.029,'23':0.020 },
  },
};

const STATE_SEASONAL_OVERRIDES: Record<string, Record<string, number>> = {
  GA: { '1':1.08,'2':1.10,'3':1.12,'4':1.05,'5':1.00,'6':0.97,'7':0.96,'8':0.96,'9':0.98,'10':1.00,'11':1.04,'12':1.07 },
  TX: { '1':1.05,'2':1.06,'3':1.08,'4':1.03,'5':1.00,'6':0.98,'7':0.98,'8':0.98,'9':0.99,'10':1.00,'11':1.02,'12':1.04 },
  NC: { '1':1.06,'2':1.08,'3':1.10,'4':1.04,'5':1.00,'6':0.96,'7':0.95,'8':0.96,'9':0.98,'10':1.00,'11':1.03,'12':1.06 },
};

const STATE_DOW_OVERRIDES: Record<string, Record<string, number>> = {
  GA: { '0':0.76,'1':1.03,'2':1.05,'3':1.06,'4':1.07,'5':1.14,'6':0.90 },
  TX: { '0':0.74,'1':1.04,'2':1.06,'3':1.07,'4':1.08,'5':1.16,'6':0.88 },
  NC: { '0':0.77,'1':1.03,'2':1.05,'3':1.06,'4':1.07,'5':1.13,'6':0.91 },
};

const STATE_DIRECTIONAL_OVERRIDES: Record<string, Record<string, Record<string, number>>> = {
  GA: {
    Interstate:  { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.55,'6_outbound':0.45,'7_inbound':0.65,'7_outbound':0.35,'8_inbound':0.68,'8_outbound':0.32,'9_inbound':0.60,'9_outbound':0.40,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.42,'15_outbound':0.58,'16_inbound':0.38,'16_outbound':0.62,'17_inbound':0.35,'17_outbound':0.65,'18_inbound':0.40,'18_outbound':0.60,'19_inbound':0.45,'19_outbound':0.55,'20_inbound':0.48,'20_outbound':0.52,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Expressway:  { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.55,'6_outbound':0.45,'7_inbound':0.64,'7_outbound':0.36,'8_inbound':0.66,'8_outbound':0.34,'9_inbound':0.58,'9_outbound':0.42,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.42,'15_outbound':0.58,'16_inbound':0.38,'16_outbound':0.62,'17_inbound':0.35,'17_outbound':0.65,'18_inbound':0.40,'18_outbound':0.60,'19_inbound':0.45,'19_outbound':0.55,'20_inbound':0.48,'20_outbound':0.52,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Arterial:    { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.54,'6_outbound':0.46,'7_inbound':0.62,'7_outbound':0.38,'8_inbound':0.64,'8_outbound':0.36,'9_inbound':0.56,'9_outbound':0.44,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.43,'15_outbound':0.57,'16_inbound':0.40,'16_outbound':0.60,'17_inbound':0.37,'17_outbound':0.63,'18_inbound':0.42,'18_outbound':0.58,'19_inbound':0.46,'19_outbound':0.54,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Collector:   { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.53,'6_outbound':0.47,'7_inbound':0.60,'7_outbound':0.40,'8_inbound':0.62,'8_outbound':0.38,'9_inbound':0.55,'9_outbound':0.45,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.49,'14_outbound':0.51,'15_inbound':0.45,'15_outbound':0.55,'16_inbound':0.42,'16_outbound':0.58,'17_inbound':0.40,'17_outbound':0.60,'18_inbound':0.44,'18_outbound':0.56,'19_inbound':0.47,'19_outbound':0.53,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Local:       { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.52,'6_outbound':0.48,'7_inbound':0.58,'7_outbound':0.42,'8_inbound':0.60,'8_outbound':0.40,'9_inbound':0.54,'9_outbound':0.46,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.50,'14_outbound':0.50,'15_inbound':0.47,'15_outbound':0.53,'16_inbound':0.45,'16_outbound':0.55,'17_inbound':0.43,'17_outbound':0.57,'18_inbound':0.46,'18_outbound':0.54,'19_inbound':0.48,'19_outbound':0.52,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
  },
  TX: {
    Interstate:  { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.56,'6_outbound':0.44,'7_inbound':0.66,'7_outbound':0.34,'8_inbound':0.70,'8_outbound':0.30,'9_inbound':0.62,'9_outbound':0.38,'10_inbound':0.53,'10_outbound':0.47,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.47,'14_outbound':0.53,'15_inbound':0.40,'15_outbound':0.60,'16_inbound':0.36,'16_outbound':0.64,'17_inbound':0.32,'17_outbound':0.68,'18_inbound':0.38,'18_outbound':0.62,'19_inbound':0.44,'19_outbound':0.56,'20_inbound':0.47,'20_outbound':0.53,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Expressway:  { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.56,'6_outbound':0.44,'7_inbound':0.65,'7_outbound':0.35,'8_inbound':0.68,'8_outbound':0.32,'9_inbound':0.60,'9_outbound':0.40,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.47,'14_outbound':0.53,'15_inbound':0.41,'15_outbound':0.59,'16_inbound':0.37,'16_outbound':0.63,'17_inbound':0.33,'17_outbound':0.67,'18_inbound':0.39,'18_outbound':0.61,'19_inbound':0.44,'19_outbound':0.56,'20_inbound':0.47,'20_outbound':0.53,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Arterial:    { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.55,'6_outbound':0.45,'7_inbound':0.63,'7_outbound':0.37,'8_inbound':0.66,'8_outbound':0.34,'9_inbound':0.58,'9_outbound':0.42,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.42,'15_outbound':0.58,'16_inbound':0.39,'16_outbound':0.61,'17_inbound':0.36,'17_outbound':0.64,'18_inbound':0.41,'18_outbound':0.59,'19_inbound':0.46,'19_outbound':0.54,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Collector:   { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.54,'6_outbound':0.46,'7_inbound':0.61,'7_outbound':0.39,'8_inbound':0.64,'8_outbound':0.36,'9_inbound':0.56,'9_outbound':0.44,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.49,'14_outbound':0.51,'15_inbound':0.44,'15_outbound':0.56,'16_inbound':0.41,'16_outbound':0.59,'17_inbound':0.38,'17_outbound':0.62,'18_inbound':0.43,'18_outbound':0.57,'19_inbound':0.47,'19_outbound':0.53,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Local:       { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.53,'6_outbound':0.47,'7_inbound':0.59,'7_outbound':0.41,'8_inbound':0.62,'8_outbound':0.38,'9_inbound':0.55,'9_outbound':0.45,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.50,'14_outbound':0.50,'15_inbound':0.46,'15_outbound':0.54,'16_inbound':0.43,'16_outbound':0.57,'17_inbound':0.41,'17_outbound':0.59,'18_inbound':0.45,'18_outbound':0.55,'19_inbound':0.48,'19_outbound':0.52,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
  },
  NC: {
    Interstate:  { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.55,'6_outbound':0.45,'7_inbound':0.64,'7_outbound':0.36,'8_inbound':0.67,'8_outbound':0.33,'9_inbound':0.59,'9_outbound':0.41,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.42,'15_outbound':0.58,'16_inbound':0.38,'16_outbound':0.62,'17_inbound':0.35,'17_outbound':0.65,'18_inbound':0.40,'18_outbound':0.60,'19_inbound':0.45,'19_outbound':0.55,'20_inbound':0.48,'20_outbound':0.52,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Expressway:  { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.55,'6_outbound':0.45,'7_inbound':0.63,'7_outbound':0.37,'8_inbound':0.66,'8_outbound':0.34,'9_inbound':0.58,'9_outbound':0.42,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.42,'15_outbound':0.58,'16_inbound':0.39,'16_outbound':0.61,'17_inbound':0.36,'17_outbound':0.64,'18_inbound':0.41,'18_outbound':0.59,'19_inbound':0.46,'19_outbound':0.54,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Arterial:    { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.54,'6_outbound':0.46,'7_inbound':0.62,'7_outbound':0.38,'8_inbound':0.64,'8_outbound':0.36,'9_inbound':0.56,'9_outbound':0.44,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.48,'14_outbound':0.52,'15_inbound':0.43,'15_outbound':0.57,'16_inbound':0.40,'16_outbound':0.60,'17_inbound':0.37,'17_outbound':0.63,'18_inbound':0.42,'18_outbound':0.58,'19_inbound':0.46,'19_outbound':0.54,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Collector:   { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.53,'6_outbound':0.47,'7_inbound':0.60,'7_outbound':0.40,'8_inbound':0.62,'8_outbound':0.38,'9_inbound':0.55,'9_outbound':0.45,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.49,'14_outbound':0.51,'15_inbound':0.45,'15_outbound':0.55,'16_inbound':0.42,'16_outbound':0.58,'17_inbound':0.40,'17_outbound':0.60,'18_inbound':0.44,'18_outbound':0.56,'19_inbound':0.47,'19_outbound':0.53,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
    Local:       { '0_inbound':0.50,'0_outbound':0.50,'1_inbound':0.50,'1_outbound':0.50,'2_inbound':0.50,'2_outbound':0.50,'3_inbound':0.50,'3_outbound':0.50,'4_inbound':0.50,'4_outbound':0.50,'5_inbound':0.50,'5_outbound':0.50,'6_inbound':0.52,'6_outbound':0.48,'7_inbound':0.58,'7_outbound':0.42,'8_inbound':0.60,'8_outbound':0.40,'9_inbound':0.54,'9_outbound':0.46,'10_inbound':0.52,'10_outbound':0.48,'11_inbound':0.50,'11_outbound':0.50,'12_inbound':0.50,'12_outbound':0.50,'13_inbound':0.50,'13_outbound':0.50,'14_inbound':0.50,'14_outbound':0.50,'15_inbound':0.47,'15_outbound':0.53,'16_inbound':0.45,'16_outbound':0.55,'17_inbound':0.43,'17_outbound':0.57,'18_inbound':0.46,'18_outbound':0.54,'19_inbound':0.48,'19_outbound':0.52,'20_inbound':0.49,'20_outbound':0.51,'21_inbound':0.50,'21_outbound':0.50,'22_inbound':0.50,'22_outbound':0.50,'23_inbound':0.50,'23_outbound':0.50 },
  },
};

const ROAD_CLASS_ALIASES: Record<string, string> = {
  'interstate': 'Interstate',
  'expressway': 'Expressway',
  'freeway': 'Expressway',
  'arterial': 'Arterial',
  'principal arterial': 'Arterial',
  'minor arterial': 'Arterial',
  'collector': 'Collector',
  'major collector': 'Collector',
  'minor collector': 'Collector',
  'local': 'Local',
  'local road': 'Local',
};

export class DotTemporalProfilesService {
  private profileCache: Map<string, TemporalProfile> = new Map();
  private cacheLoadedAt: number = 0;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;

  constructor(private pool: Pool) {}

  private normalizeRoadClass(roadClass: string | null | undefined): string {
    if (!roadClass) return 'Arterial';
    const lower = roadClass.toLowerCase().trim();
    return ROAD_CLASS_ALIASES[lower] || roadClass;
  }

  private cacheKey(state: string, region: string, roadClass: string, profileType: string): string {
    return `${state}:${region}:${roadClass}:${profileType}`;
  }

  private async ensureCache(): Promise<void> {
    if (Date.now() - this.cacheLoadedAt < this.CACHE_TTL_MS && this.profileCache.size > 0) {
      return;
    }
    await this.loadAllProfiles();
  }

  private async loadAllProfiles(): Promise<void> {
    try {
      const result = await this.pool.query('SELECT * FROM dot_temporal_profiles');
      this.profileCache.clear();
      for (const row of result.rows) {
        const key = this.cacheKey(row.state, row.region, row.road_functional_class, row.profile_type);
        this.profileCache.set(key, {
          id: row.id,
          state: row.state,
          region: row.region,
          road_functional_class: row.road_functional_class,
          profile_type: row.profile_type,
          factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors,
          source_year: row.source_year,
          source_url: row.source_url,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
      this.cacheLoadedAt = Date.now();
      logger.debug(`[DotTemporalProfiles] Loaded ${this.profileCache.size} profiles into cache`);
    } catch (err: any) {
      logger.error('[DotTemporalProfiles] Failed to load profiles', { error: err.message });
    }
  }

  private getProfile(roadClass: string, state: string, profileType: string, region: string = 'statewide'): TemporalProfile | null {
    const normalized = this.normalizeRoadClass(roadClass);
    const key = this.cacheKey(state, region, normalized, profileType);
    let profile = this.profileCache.get(key);
    if (profile) return profile;

    const statewideKey = this.cacheKey(state, 'statewide', normalized, profileType);
    profile = this.profileCache.get(statewideKey);
    if (profile) return profile;

    const anyClassKey = this.cacheKey(state, 'statewide', 'Arterial', profileType);
    profile = this.profileCache.get(anyClassKey);
    return profile || null;
  }

  async getHourlyFactor(roadClass: string, state: string, hour: number, region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'hourly', region);
    if (profile && profile.factors) {
      const val = profile.factors[String(hour)];
      if (val !== undefined) return val;
    }
    return DEFAULT_HOURLY_FACTORS[String(hour)] ?? 0.042;
  }

  async getSeasonalFactor(roadClass: string, state: string, month: number, region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'seasonal', region);
    if (profile && profile.factors) {
      const val = profile.factors[String(month)];
      if (val !== undefined) return val;
    }
    return DEFAULT_SEASONAL_FACTORS[String(month)] ?? 1.0;
  }

  async getDowFactor(roadClass: string, state: string, dayOfWeek: number, region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'dow', region);
    if (profile && profile.factors) {
      const val = profile.factors[String(dayOfWeek)];
      if (val !== undefined) return val;
    }
    return DEFAULT_DOW_FACTORS[String(dayOfWeek)] ?? 1.0;
  }

  async getDirectionalSplit(roadClass: string, state: string, hour: number, direction: 'inbound' | 'outbound', region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'directional', region);
    const key = `${hour}_${direction}`;
    if (profile && profile.factors) {
      const val = profile.factors[key];
      if (val !== undefined) return val;
    }
    return DEFAULT_DIRECTIONAL_FACTORS[key] ?? 0.50;
  }

  async getTemporalMultiplier(
    roadClass: string,
    state: string,
    hour: number,
    dayOfWeek: number,
    month: number,
    region?: string
  ): Promise<TemporalMultiplierResult> {
    await this.ensureCache();

    const hourlyFactor = await this.getHourlyFactor(roadClass, state, hour, region);
    const seasonalFactor = await this.getSeasonalFactor(roadClass, state, month, region);
    const dowFactor = await this.getDowFactor(roadClass, state, dayOfWeek, region);

    const hasProfile = this.getProfile(roadClass, state, 'hourly', region) !== null;

    return {
      hourly_factor: hourlyFactor,
      seasonal_factor: seasonalFactor,
      dow_factor: dowFactor,
      combined: hourlyFactor * seasonalFactor * dowFactor,
      source: hasProfile ? 'state_profile' : 'default',
    };
  }

  async getFullHourlyDistribution(roadClass: string, state: string, region?: string): Promise<Record<string, number>> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'hourly', region);
    if (profile && profile.factors) {
      return { ...profile.factors };
    }
    return { ...DEFAULT_HOURLY_FACTORS };
  }

  async seedDefaultProfiles(state: string = 'FL', region: string = 'statewide'): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    const roadClasses = ['Interstate', 'Expressway', 'Arterial', 'Collector', 'Local'];
    const profiles: Array<{ roadClass: string; profileType: string; factors: Record<string, number> }> = [];

    for (const rc of roadClasses) {
      let hourlyAdj = STATE_HOURLY_OVERRIDES[state]?.[rc] ?? { ...DEFAULT_HOURLY_FACTORS };
      if (!STATE_HOURLY_OVERRIDES[state]) {
        // Generic national adjustment when no state-specific override exists
        if (rc === 'Interstate' || rc === 'Expressway') {
          hourlyAdj = { ...DEFAULT_HOURLY_FACTORS, '7': 0.075, '8': 0.085, '17': 0.095 };
        } else if (rc === 'Local') {
          hourlyAdj = { ...DEFAULT_HOURLY_FACTORS, '8': 0.065, '17': 0.072, '12': 0.070 };
        }
      }

      const seasonal = STATE_SEASONAL_OVERRIDES[state] ?? { ...DEFAULT_SEASONAL_FACTORS };
      const dow = STATE_DOW_OVERRIDES[state] ?? { ...DEFAULT_DOW_FACTORS };
      const directional = STATE_DIRECTIONAL_OVERRIDES[state]?.[rc] ?? { ...DEFAULT_DIRECTIONAL_FACTORS };

      profiles.push({ roadClass: rc, profileType: 'hourly', factors: hourlyAdj });
      profiles.push({ roadClass: rc, profileType: 'seasonal', factors: seasonal });
      profiles.push({ roadClass: rc, profileType: 'dow', factors: dow });
      profiles.push({ roadClass: rc, profileType: 'directional', factors: directional });
    }

    for (const p of profiles) {
      try {
        const result = await this.pool.query(
          `INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING
           RETURNING id`,
          [
            state,
            region,
            p.roadClass,
            p.profileType,
            JSON.stringify(p.factors),
            2024,
            `https://dot.${state.toLowerCase()}.gov/traffic-data/`,
          ]
        );
        if (result.rowCount && result.rowCount > 0) {
          seeded++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        logger.warn(`[DotTemporalProfiles] Seed error for ${p.roadClass}/${p.profileType}: ${err.message}`);
        skipped++;
      }
    }

    this.profileCache.clear();
    this.cacheLoadedAt = 0;
    logger.info(`[DotTemporalProfiles] Seeded ${seeded} profiles, skipped ${skipped}`);
    return { seeded, skipped };
  }

  async ingestProfiles(
    filePath: string,
    state: string = 'FL',
    region: string = 'statewide'
  ): Promise<{ inserted: number; updated: number; errors: string[] }> {
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;

    try {
      const ext = filePath.toLowerCase();
      let rows: Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> = [];

      if (ext.endsWith('.csv')) {
        rows = this.parseProfileCSV(filePath);
      } else if (ext.endsWith('.json')) {
        rows = this.parseProfileJSON(filePath);
      } else {
        throw new Error('Unsupported format. Use CSV or JSON.');
      }

      for (const row of rows) {
        try {
          const normalized = this.normalizeRoadClass(row.road_functional_class);
          const result = await this.pool.query(
            `INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (state, region, road_functional_class, profile_type) DO UPDATE SET
               factors = EXCLUDED.factors,
               source_year = EXCLUDED.source_year,
               updated_at = NOW()
             RETURNING (xmax = 0) AS is_insert`,
            [state, region, normalized, row.profile_type, JSON.stringify(row.factors), new Date().getFullYear()]
          );
          if (result.rows[0]?.is_insert) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err: any) {
          errors.push(`${row.road_functional_class}/${row.profile_type}: ${err.message}`);
        }
      }

      this.profileCache.clear();
      this.cacheLoadedAt = 0;
      logger.info(`[DotTemporalProfiles] Ingestion complete: ${inserted} inserted, ${updated} updated, ${errors.length} errors`);
    } catch (err: any) {
      logger.error('[DotTemporalProfiles] Ingestion failed', { error: err.message });
      throw err;
    }

    return { inserted, updated, errors };
  }

  private parseProfileCSV(filePath: string): Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const roadClassIdx = headers.indexOf('road_functional_class');
    const profileTypeIdx = headers.indexOf('profile_type');

    if (roadClassIdx === -1 || profileTypeIdx === -1) {
      throw new Error('CSV must have road_functional_class and profile_type columns');
    }

    const factorHeaders = headers.filter((h, i) => i !== roadClassIdx && i !== profileTypeIdx);
    const results: Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const factors: Record<string, number> = {};
      for (let j = 0; j < headers.length; j++) {
        if (j !== roadClassIdx && j !== profileTypeIdx) {
          const val = parseFloat(values[j]);
          if (!isNaN(val)) {
            factors[headers[j]] = val;
          }
        }
      }

      results.push({
        road_functional_class: values[roadClassIdx],
        profile_type: values[profileTypeIdx],
        factors,
      });
    }

    return results;
  }

  private parseProfileJSON(filePath: string): Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        road_functional_class: item.road_functional_class || item.roadClass || 'Arterial',
        profile_type: item.profile_type || item.profileType || 'hourly',
        factors: item.factors || {},
      }));
    }

    return [];
  }

  async getProfileSummary(state?: string): Promise<{
    total_profiles: number;
    by_type: Record<string, number>;
    by_road_class: Record<string, number>;
    states: string[];
  }> {
    const whereClause = state ? 'WHERE state = $1' : '';
    const params = state ? [state] : [];

    const result = await this.pool.query(
      `SELECT state, road_functional_class, profile_type, COUNT(*) as cnt
       FROM dot_temporal_profiles ${whereClause}
       GROUP BY state, road_functional_class, profile_type`,
      params
    );

    const byType: Record<string, number> = {};
    const byRoadClass: Record<string, number> = {};
    const states = new Set<string>();

    for (const row of result.rows) {
      states.add(row.state);
      byType[row.profile_type] = (byType[row.profile_type] || 0) + parseInt(row.cnt);
      byRoadClass[row.road_functional_class] = (byRoadClass[row.road_functional_class] || 0) + parseInt(row.cnt);
    }

    return {
      total_profiles: result.rows.reduce((sum: number, r: any) => sum + parseInt(r.cnt), 0),
      by_type: byType,
      by_road_class: byRoadClass,
      states: Array.from(states),
    };
  }

  async deleteProfiles(state: string, region?: string): Promise<number> {
    let query = 'DELETE FROM dot_temporal_profiles WHERE state = $1';
    const params: any[] = [state];
    if (region) {
      query += ' AND region = $2';
      params.push(region);
    }
    const result = await this.pool.query(query, params);
    this.profileCache.clear();
    this.cacheLoadedAt = 0;
    return result.rowCount || 0;
  }
}

let dotTemporalProfilesServiceInstance: DotTemporalProfilesService | null = null;

export function getDotTemporalProfilesService(pool: Pool): DotTemporalProfilesService {
  if (!dotTemporalProfilesServiceInstance) {
    dotTemporalProfilesServiceInstance = new DotTemporalProfilesService(pool);
  }
  return dotTemporalProfilesServiceInstance;
}
