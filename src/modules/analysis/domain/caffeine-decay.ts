const HALF_LIFE_HOURS = 5;

const normalizeHours = (hours: number): number | null => {
  if (!Number.isFinite(hours) || hours < 0) {
    return null;
  }

  return hours;
};

export const calculateCaffeineRemainingAtBed = (mg: number, hoursSinceConsumption: number): number => {
  if (!Number.isFinite(mg) || mg < 0 || !Number.isFinite(hoursSinceConsumption) || hoursSinceConsumption < 0) {
    return 0;
  }

  const hours = normalizeHours(hoursSinceConsumption);
  if (hours === null) {
    return 0;
  }

  return mg * Math.pow(0.5, hours / HALF_LIFE_HOURS);
};
