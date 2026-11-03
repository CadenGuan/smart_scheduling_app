import { ConferenceDeadline } from 'shared';

export const SAMPLE_CONFERENCE_DEADLINES: Omit<ConferenceDeadline, 'daysUntilDeadline' | 'status'>[] = [
  {
    id: 'ucsc-urs-2027',
    name: 'UCSC Baskin Engineering Undergraduate Research Symposium (URS 2027)',
    abbreviation: 'UCSC URS 2027',
    tier: 'Undergraduate Showcase',
    submissionDeadline: '2027-05-15',
    notificationDate: '2027-05-28',
    conferenceDates: 'June 5, 2027',
    location: 'Baskin Engineering Courtyard, UC Santa Cruz',
    topics: ['Software Engineering', 'Systems', 'AI & Machine Learning', 'HCI & Design'],
    websiteUrl: 'https://undergrad.soe.ucsc.edu/symposium',
    description:
      'The premier annual research showcase for UCSC undergraduate engineers. Present posters, software demos, and technical abstracts to Silicon Valley industry judges.',
  },
  {
    id: 'icse-src-2027',
    name: 'IEEE/ACM ICSE 2027 Student Research Competition',
    abbreviation: 'ICSE SRC 2027',
    tier: 'Undergraduate Showcase',
    submissionDeadline: '2027-02-15',
    notificationDate: '2027-03-20',
    conferenceDates: 'May 23-29, 2027',
    location: 'Ottawa, Canada',
    topics: ['Software Engineering', 'Testing & Verification', 'DevOps & Tools'],
    websiteUrl: 'https://conf.researchr.org/home/icse-2027',
    description:
      'ACM Student Research Competition at the world premier software engineering conference. Ideal for CSE 115A team projects with novel software architecture or tooling.',
  },
  {
    id: 'sigcse-2027',
    name: 'ACM Technical Symposium on Computer Science Education (SIGCSE 2027)',
    abbreviation: 'SIGCSE 2027',
    tier: 'Major Conference',
    submissionDeadline: '2026-12-05',
    notificationDate: '2027-01-20',
    conferenceDates: 'March 3-6, 2027',
    location: 'Portland, Oregon',
    topics: ['CS Education', 'Pedagogy', 'Interactive Learning Tools'],
    websiteUrl: 'https://sigcse2027.sigcse.org',
    description:
      'The flagship conference for computer science education tools and curriculum innovation. Excellent target for automated tutoring and scheduling agents.',
  },
  {
    id: 'osdi-2027',
    name: 'USENIX Symposium on Operating Systems Design and Implementation (OSDI 2027)',
    abbreviation: 'OSDI 2027',
    tier: 'Top Tier',
    submissionDeadline: '2027-05-07',
    notificationDate: '2027-06-25',
    conferenceDates: 'July 12-14, 2027',
    location: 'Seattle, Washington',
    topics: ['Systems', 'Storage & Filesystems', 'Concurrency', 'Distributed Systems'],
    websiteUrl: 'https://www.usenix.org/conference/osdi27',
    description:
      'The highest-impact systems research venue. Relevant for advanced coursework stemming from CSE 130 and graduate systems projects.',
  },
  {
    id: 'sigmod-src-2027',
    name: 'ACM SIGMOD 2027 Undergraduate Research Competition',
    abbreviation: 'SIGMOD SRC 2027',
    tier: 'Undergraduate Showcase',
    submissionDeadline: '2027-03-01',
    notificationDate: '2027-04-10',
    conferenceDates: 'June 20-25, 2027',
    location: 'Berlin, Germany',
    topics: ['Databases', 'Query Optimization', 'Data Systems'],
    websiteUrl: 'https://2027.sigmod.org',
    description:
      'Top database venue offering undergraduate research awards for database indexing, transaction models, and query engine optimizations.',
  },
  {
    id: 'neurips-2027',
    name: 'Conference on Neural Information Processing Systems (NeurIPS 2027)',
    abbreviation: 'NeurIPS 2027',
    tier: 'Top Tier',
    submissionDeadline: '2027-05-20',
    notificationDate: '2027-09-15',
    conferenceDates: 'December 6-12, 2027',
    location: 'New Orleans, Louisiana',
    topics: ['AI & Machine Learning', 'Deep Learning', 'Reinforcement Learning'],
    websiteUrl: 'https://neurips.cc',
    description:
      'The largest international artificial intelligence conference covering foundation models, neural architectures, and computational learning theory.',
  },
  {
    id: 'chi-lbw-2027',
    name: 'ACM CHI 2027 Late-Breaking Work (LBW)',
    abbreviation: 'CHI LBW 2027',
    tier: 'Major Conference',
    submissionDeadline: '2027-01-18',
    notificationDate: '2027-02-28',
    conferenceDates: 'April 24-29, 2027',
    location: 'Yokohama, Japan',
    topics: ['HCI & Design', 'Interactive Systems', 'Accessibility'],
    websiteUrl: 'https://chi2027.acm.org',
    description:
      'Leading venue for human-computer interaction research and interactive UI prototypes. Great for accessible scheduling and UI design innovations.',
  },
];

export class DeadlinesService {
  static getDeadlines(
    topicFilter?: string,
    tierFilter?: string,
    referenceDate: Date = new Date()
  ): {
    totalCount: number;
    deadlines: ConferenceDeadline[];
    topics: string[];
  } {
    const allTopics = new Set<string>();
    SAMPLE_CONFERENCE_DEADLINES.forEach((c) => {
      c.topics.forEach((t) => allTopics.add(t));
    });

    const enriched: ConferenceDeadline[] = SAMPLE_CONFERENCE_DEADLINES.map((conf) => {
      const deadlineDate = new Date(`${conf.submissionDeadline}T23:59:59Z`);
      const diffMs = deadlineDate.getTime() - referenceDate.getTime();
      const daysUntilDeadline = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status: 'URGENT' | 'UPCOMING' | 'OPEN' | 'PASSED' = 'OPEN';
      if (daysUntilDeadline < 0) {
        status = 'PASSED';
      } else if (daysUntilDeadline <= 14) {
        status = 'URGENT';
      } else if (daysUntilDeadline <= 45) {
        status = 'UPCOMING';
      }

      return {
        ...conf,
        daysUntilDeadline,
        status,
      };
    });

    let filtered = enriched;
    if (topicFilter && topicFilter !== 'ALL') {
      filtered = filtered.filter((d) =>
        d.topics.some((t) => t.toLowerCase() === topicFilter.toLowerCase())
      );
    }

    if (tierFilter && tierFilter !== 'ALL') {
      filtered = filtered.filter((d) => d.tier === tierFilter);
    }

    // Sort: positive upcoming deadlines first (nearest first), then passed
    filtered.sort((a, b) => {
      if ((a.daysUntilDeadline || 0) >= 0 && (b.daysUntilDeadline || 0) < 0) return -1;
      if ((a.daysUntilDeadline || 0) < 0 && (b.daysUntilDeadline || 0) >= 0) return 1;
      return (a.daysUntilDeadline || 0) - (b.daysUntilDeadline || 0);
    });

    return {
      totalCount: filtered.length,
      deadlines: filtered,
      topics: Array.from(allTopics).sort(),
    };
  }

  /**
   * Generates standard RFC 5545 iCalendar string for all academic and conference deadlines
   * with 1-day advance VALARM notifications.
   */
  static exportDeadlinesIcs(deadlines: ConferenceDeadline[]): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SlugSchedule//UCSC Conference Deadlines//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:UCSC CS Research & Conference Deadlines',
      'X-WR-TIMEZONE:America/Los_Angeles',
    ];

    for (const conf of deadlines) {
      const dateClean = conf.submissionDeadline.replace(/-/g, '');
      const uid = `conf-deadline-${conf.id}@slugschedule.ucsc.edu`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dateClean}T000000Z`);
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`SUMMARY:🎯 [Deadline] ${conf.abbreviation} Submission`);
      lines.push(
        `DESCRIPTION:${conf.name} - ${conf.description.replace(/,/g, '\\,')} Location: ${conf.location}. Topics: ${conf.topics.join(', ')}.`
      );
      lines.push(`LOCATION:${conf.location}`);
      lines.push('STATUS:CONFIRMED');
      lines.push('TRANSP:TRANSPARENT');

      // 1-Day Advance Alert
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-P1D');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Paper Submission Due Tomorrow: ${conf.abbreviation}`);
      lines.push('END:VALARM');

      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
}
