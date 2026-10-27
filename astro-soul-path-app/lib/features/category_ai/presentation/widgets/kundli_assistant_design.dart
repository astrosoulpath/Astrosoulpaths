import 'package:flutter/material.dart';

/// UI catalogue only. API keys preserve the existing server category contract.
class KundliAssistantDesign {
  const KundliAssistantDesign({
    required this.id,
    required this.title,
    required this.apiKey,
    required this.icon,
    required this.heroTitle,
    required this.topics,
    required this.questions,
    required this.messages,
    this.topicQuestionIndices = const [0, 1, 2, 3],
  });
  final String id, title, apiKey, heroTitle;
  final IconData icon;
  final List<String> topics, questions, messages;
  final List<int> topicQuestionIndices;
}

const marriageAssistant = KundliAssistantDesign(
  topicQuestionIndices: [1, 3, 2, 5],
  id: 'marriage',
  title: 'Marriage',
  apiKey: 'marriage',
  icon: Icons.favorite_outline,
  heroTitle: 'Written in the stars.\nGuided by you.',
  topics: [
    'Marriage timing',
    'Compatibility',
    'Communication',
    'Lasting partnership',
  ],
  questions: [
    'What relationship patterns can my Kundli help me understand?',
    'How should I approach marriage timing thoughtfully?',
    'What can my chart suggest about communication in marriage?',
    'How is compatibility assessed in Vedic astrology?',
    'What should I consider before choosing a life partner?',
    'How can I nurture a balanced long-term partnership?',
  ],
  messages: [
    'Explore partnership through a thoughtful Vedic lens.',
    'Understand communication and emotional connection.',
    'Reflect on compatibility and shared values.',
    'Explore timing without losing sight of your choices.',
    'Bring your questions about commitment and growth.',
    'Your choices remain at the heart of your journey.',
  ],
);

const careerAssistant = KundliAssistantDesign(
  topicQuestionIndices: [1, 2, 3, 0],
  id: 'career',
  title: 'Career',
  apiKey: 'career',
  icon: Icons.work_outline,
  heroTitle: 'Your strengths.\nYour next chapter.',
  topics: [
    'Career direction',
    'Job opportunities',
    'Promotion',
    'Professional strengths',
  ],
  questions: [
    'What professional strengths are supported by my Kundli?',
    'How can I reflect on my career direction?',
    'What can verified chart evidence say about job opportunities?',
    'How should I think about promotion and professional growth?',
    'What are the limits of astrological career timing?',
    'How can I approach a career transition thoughtfully?',
  ],
  messages: [
    'Explore professional strengths with grounded chart context.',
    'Reflect on work that aligns with your values.',
    'Consider career changes without guaranteed outcomes.',
    'Discuss growth and responsibility at work.',
    'Ask about timing without invented joining dates.',
    'Keep practical skills and informed choices at the center.',
  ],
);

const loveAssistant = KundliAssistantDesign(
  topicQuestionIndices: [1, 0, 3, 4],
  id: 'love',
  title: 'Love',
  apiKey: 'love',
  icon: Icons.favorite_border,
  heroTitle: 'Understand connection.\nMake room for growth.',
  topics: [
    'Emotional connection',
    'Relationship patterns',
    'Love compatibility',
    'Communication',
  ],
  questions: [
    'What emotional patterns can my Kundli help me reflect on?',
    'How can I build a healthier connection?',
    'What relationship strengths are supported by my chart?',
    'How can I understand love compatibility thoughtfully?',
    'What can astrology say about communication without assuming my relationship status?',
    'How can I approach commitment with clarity?',
  ],
  messages: [
    'Explore emotional connection without assumptions.',
    'Reflect on the patterns you bring to relationships.',
    'Consider compatibility alongside respect and shared values.',
    'Discuss communication with care and openness.',
    'Your relationship status is never assumed.',
    'Astrology offers perspective, not promises about a partner.',
  ],
);

const matchAssistant = KundliAssistantDesign(
  id: 'match',
  title: 'Match',
  apiKey: 'marriage',
  icon: Icons.join_inner,
  heroTitle: 'Two perspectives.\nA thoughtful connection.',
  topics: [
    'Guna Milan',
    'Compatibility',
    'Relationship strengths',
    'Areas for discussion',
  ],
  questions: [
    'What is Guna Milan, and what verified data is needed to calculate it?',
    'What can my own Kundli say about compatibility themes?',
    'What relationship strengths should partners discuss?',
    'What limitations apply when a second authorized chart is unavailable?',
    'How should we discuss differing expectations?',
    'How can shared values complement an astrological compatibility discussion?',
  ],
  messages: [
    'Explore compatibility through thoughtful questions.',
    'Learn what Guna Milan requires before drawing conclusions.',
    'No compatibility score is invented from one chart.',
    'A second chart requires its own authorized access.',
    'Reflect on relationship strengths and honest discussion.',
    'Mutual respect matters beyond any astrological interpretation.',
  ],
);

const marketAssistant = KundliAssistantDesign(
  topicQuestionIndices: [0, 1, 3, 2],
  id: 'stockMarket',
  title: 'Stock Market',
  apiKey: 'stock_market',
  icon: Icons.candlestick_chart_outlined,
  heroTitle: 'Perspective on patterns.\nClarity about risk.',
  topics: [
    'Market themes',
    'Risk awareness',
    'Financial timing',
    'Planetary interpretations',
  ],
  questions: [
    'What are the limits of astrology for understanding market themes?',
    'How can I reflect on my risk-taking tendencies?',
    'What financial patterns are supported by my Kundli?',
    'Why should planetary timing not be treated as a trade signal?',
    'How can I distinguish interpretation from investment advice?',
    'What practical safeguards should accompany financial decisions?',
  ],
  messages: [
    'Explore financial tendencies, not price predictions.',
    'No guaranteed returns or buy-and-sell recommendations.',
    'Keep diversification and qualified advice in view.',
    'Planetary interpretation is not a trading signal.',
    'Reflect on risk awareness and financial habits.',
    'Market outcomes cannot be promised by a chart.',
  ],
);

const todayAssistant = KundliAssistantDesign(
  id: 'today',
  title: 'Today',
  apiKey: 'today',
  icon: Icons.wb_sunny_outlined,
  heroTitle: 'Meet today\nwith a little perspective.',
  topics: ['Daily overview', 'Relationships', 'Work', 'Wellbeing'],
  questions: [
    'What daily themes are supported by my verified Kundli context?',
    'How can I approach relationships thoughtfully today?',
    'What professional strengths can I focus on today?',
    'How can I reflect on balance and wellbeing without medical predictions?',
    'What are the limits of a daily astrological interpretation?',
    'What intention can I consider while making my own choices today?',
  ],
  messages: [
    'Begin with a reflective daily overview.',
    'Bring care to everyday conversations.',
    'Consider your priorities at work.',
    'Make space for rest without medical claims.',
    'Daily interpretation is not a guaranteed event forecast.',
    'Your decisions shape how you meet the day.',
  ],
);

const businessAssistant = KundliAssistantDesign(
  topicQuestionIndices: [1, 2, 3, 4],
  id: 'business',
  title: 'Business',
  apiKey: 'business',
  icon: Icons.business_center_outlined,
  heroTitle: 'Build with intention.\nPlan with perspective.',
  topics: ['Business direction', 'Partnerships', 'Planning', 'Growth patterns'],
  questions: [
    'What entrepreneurial strengths are supported by my Kundli?',
    'How can I reflect on business direction?',
    'What partnership themes should I discuss openly?',
    'How should I balance planning with astrological interpretation?',
    'What are the limits of predicting business growth from a chart?',
    'How can practical due diligence complement this guidance?',
  ],
  messages: [
    'Reflect on entrepreneurship through verified context.',
    'Explore partnership patterns without assuming outcomes.',
    'Keep planning and due diligence central.',
    'Discuss strengths for responsible growth.',
    'No chart guarantees revenue or business success.',
    'Let interpretation inform questions, not replace decisions.',
  ],
);

const kundliAssistantDesigns = [
  marriageAssistant,
  careerAssistant,
  loveAssistant,
  matchAssistant,
  marketAssistant,
  todayAssistant,
  businessAssistant,
];
