export class DailyInsightMapper {
  static toUI(apiResponse: any, user: any) {
    const data = apiResponse?.data || apiResponse;

    return {
      // =============================
      // 🧑 USER HEADER
      // =============================
      user: {
        name: user?.name || data?.subject_name || 'User',
        greeting: this.getGreeting(),
        date: data?.prediction_date,

        natalNakshatra: data?.natal_moon?.nakshatra,
        natalNakshatraNumber: data?.natal_moon?.nakshatra_number,
        natalNakshatraLord: data?.natal_moon?.nakshatra_lord,

        currentNakshatra: data?.current_moon?.nakshatra,
        currentNakshatraNumber: data?.current_moon?.nakshatra_number,
      },

      // =============================
      // 🌌 COSMIC OVERVIEW
      // =============================
      cosmic: {
        overallScore: data?.overall_score || 0,

        tarabala: {
          name: data?.tarabala?.name,
          count: data?.tarabala?.count,
          effect: data?.tarabala?.effect,
        },
      },

      // =============================
      // 🌙 CURRENT MOON DETAILS
      // =============================
      moon: {
        current: {
          nakshatra: data?.current_moon?.nakshatra,
          number: data?.current_moon?.nakshatra_number,
          lord: data?.current_moon?.nakshatra_lord,
          deity: data?.current_moon?.nakshatra_deity,
          pada: data?.current_moon?.pada,
        },

        natal: {
          nakshatra: data?.natal_moon?.nakshatra,
          number: data?.natal_moon?.nakshatra_number,
          lord: data?.natal_moon?.nakshatra_lord,
        },
      },

      // =============================
      // 🔮 LIFE AREA PREDICTIONS
      // =============================
      lifeAreas: [
        {
          title: 'General',
          description: data?.predictions?.general,
          emoji: '✨',
        },
        {
          title: 'Career',
          description: data?.predictions?.career,
          emoji: '💼',
        },
        {
          title: 'Relationships',
          description: data?.predictions?.relationships,
          emoji: '❤️',
        },
        {
          title: 'Health',
          description: data?.predictions?.health,
          emoji: '🧘',
        },
        {
          title: 'Finance',
          description: data?.predictions?.finance,
          emoji: '💰',
        },
      ],

      // =============================
      // 🍀 LUCKY ELEMENTS
      // =============================
      lucky: {
        colors: this.capitalize(data?.guidance?.lucky_colors || []),
        numbers: data?.guidance?.lucky_numbers || [],
      },

      // =============================
      // 🪐 GUIDANCE
      // =============================
      guidance: {
        favorableActivities: this.capitalize(
          data?.guidance?.favorable_activities || [],
        ),

        avoidActivities: this.capitalize(
          data?.guidance?.avoid_activities || [],
        ),
      },

      // =============================
      // 📊 SUMMARY CARD
      // =============================
      summary: {
        bestFor: this.formatActivities(
          data?.guidance?.favorable_activities || [],
        ),

        cautionFor: this.formatActivities(
          data?.guidance?.avoid_activities || [],
        ),
      },
    };
  }

  // =============================
  // 🔧 HELPERS
  // =============================

  static getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';

    return 'Good Evening';
  }

  static capitalize(arr: string[] = []) {
    return arr.map((item) => item.charAt(0).toUpperCase() + item.slice(1));
  }

  static formatActivities(arr: string[] = []) {
    if (!arr.length) return '';
    return arr.join(', ');
  }
}
