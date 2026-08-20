export const CARE_TOOL_CATALOG = [
  { key: "breathing", label: "호흡 가이드", defaultSeconds: 180 },
  { key: "white-noise", label: "백색소음", defaultSeconds: 900 },
  { key: "sleep-guide", label: "5분 이완", defaultSeconds: 300 },
] as const;

export type CareToolKey = (typeof CARE_TOOL_CATALOG)[number]["key"];

export const BREATHING_PHASES = [
  { key: "inhale", label: "들이마시기", seconds: 4 },
  { key: "hold", label: "멈추기", seconds: 2 },
  { key: "exhale", label: "내쉬기", seconds: 6 },
] as const;

export const SLEEP_GUIDE_STEPS = [
  { startsAtSeconds: 0, label: "편안한 자세를 잡고 눈을 감아보세요." },
  { startsAtSeconds: 60, label: "턱과 이마의 힘을 천천히 풀어주세요." },
  { startsAtSeconds: 120, label: "어깨와 손끝의 긴장을 내려놓으세요." },
  { startsAtSeconds: 180, label: "오늘의 생각은 잠시 옆에 두어도 괜찮아요." },
  { startsAtSeconds: 240, label: "호흡을 세지 말고 자연스럽게 쉬어보세요." },
] as const;

export const careToolFor = (key: CareToolKey) => CARE_TOOL_CATALOG.find((tool) => tool.key === key)!;
