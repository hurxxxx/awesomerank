export interface Question {
  id: string;
  text: string;
  probability: number;
  category: string;
  description?: string;
}

export const questions: Question[] = [
  {
    id: "Q1",
    text: "당신의 집에는 전기가 공급됩니까?",
    probability: 0.916,
    category: "1단계: 인프라 (생존)",
  },
  {
    id: "Q2",
    text: "간단한 문장을 읽고 쓸 수 있습니까?",
    probability: 0.880,
    category: "1단계: 인프라 (생존)",
  },
  {
    id: "Q3",
    text: "은행 계좌나 모바일 머니 계정을 가지고 있습니까?",
    probability: 0.790,
    category: "1단계: 인프라 (생존)",
  },
  {
    id: "Q4",
    text: "수세식 화장실이나 개선된 위생 시설이 있습니까?",
    probability: 0.780,
    category: "1단계: 인프라 (생존)",
  },
  {
    id: "Q5",
    text: "당신의 집에는 냉장고가 있습니까?",
    probability: 0.780,
    category: "1단계: 인프라 (생존)",
  },
  {
    id: "Q6",
    text: "집에서 쫓겨날 걱정 없이 살고 있습니까?",
    probability: 0.770,
    category: "1단계: 인프라 (생존)",
  },
  {
    id: "Q7",
    text: "인터넷을 사용합니까?",
    probability: 0.740,
    category: "2단계: 연결성 (정보)",
  },
  {
    id: "Q8",
    text: "댁내에서 안전한 식수를 이용할 수 있습니까?",
    probability: 0.740,
    category: "2단계: 연결성 (정보)",
  },
  {
    id: "Q9",
    text: "과밀하지 않은 주거 환경에서 살고 있습니까?",
    probability: 0.700,
    category: "2단계: 연결성 (정보)",
  },
  {
    id: "Q10",
    text: "건강한 식단을 경제적으로 감당할 수 있습니까?",
    probability: 0.680,
    category: "2단계: 연결성 (정보)",
  },
  {
    id: "Q11",
    text: "개인 소유의 스마트폰을 가지고 있습니까?",
    probability: 0.600,
    category: "3단계: 자산 (편의)",
  },
  {
    id: "Q12",
    text: "고등학교(중등교육)를 졸업했습니까?",
    probability: 0.590,
    category: "3단계: 자산 (편의)",
  },
  {
    id: "Q13",
    text: "병원비 걱정 없이 필수 의료 서비스를 받을 수 있습니까?",
    probability: 0.550,
    category: "3단계: 자산 (편의)",
  },
  {
    id: "Q14",
    text: "유급 휴가/병가 등 사회적 보호 혜택을 받고 있습니까?",
    probability: 0.524,
    category: "3단계: 자산 (편의)",
  },
  {
    id: "Q15",
    text: "하루에 12달러(약 1.6만원) 이상을 소비합니까?",
    probability: 0.500,
    category: "3단계: 자산 (편의)",
  },
  {
    id: "Q16",
    text: "연 1회 이상 예방적 치과 진료를 받습니까?",
    probability: 0.450,
    category: "4단계: 인적 자본 (능력)",
  },
  {
    id: "Q17",
    text: "가구에 자가용(자동차)을 소유하고 있습니까?",
    probability: 0.450,
    category: "4단계: 인적 자본 (능력)",
  },
  {
    id: "Q18",
    text: "집에는 세탁기가 있습니까?",
    probability: 0.400,
    category: "4단계: 인적 자본 (능력)",
  },
  {
    id: "Q19",
    text: "일주일에 한 번 이상 외식을 하거나 배달 음식을 먹습니까?",
    probability: 0.350,
    category: "4단계: 인적 자본 (능력)",
  },
  {
    id: "Q20",
    text: "집에는 가정용 광대역 인터넷(브로드밴드)이 있습니까?",
    probability: 0.300,
    category: "4단계: 인적 자본 (능력)",
  },
  {
    id: "Q21",
    text: "대학 학위(학사 이상)를 가지고 있습니까?",
    probability: 0.250,
    category: "5단계: 이동성 (엘리트)",
  },
  {
    id: "Q22",
    text: "유효한 여권을 가지고 있습니까?",
    probability: 0.250,
    category: "5단계: 이동성 (엘리트)",
  },
  {
    id: "Q23",
    text: "비행기를 타본 적이 있습니까?",
    probability: 0.200,
    category: "5단계: 이동성 (엘리트)",
  },
  {
    id: "Q24",
    text: "5G 인터넷을 사용합니까?",
    probability: 0.200,
    category: "5단계: 이동성 (엘리트)",
  },
  {
    id: "Q25",
    text: "유료 스트리밍 서비스(넷플릭스 등)를 구독하고 있습니까?",
    probability: 0.150,
    category: "5단계: 이동성 (엘리트)",
  },
];
