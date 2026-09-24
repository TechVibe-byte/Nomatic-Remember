import { Priority, RecurrenceType } from '../types.ts';

export interface ParsedReminderInput {
  title: string;
  dueDate: string; // ISO string
  recurrence: RecurrenceType;
  priority: Priority;
  category: string;
}

/**
 * Parses natural reminder text like:
 * "7:00 AM Go to office"
 * "Go to office at 7:00 AM"
 * "Tomorrow at 9:30 AM sprint meeting"
 * "Every day at 8am Morning workout"
 */
export function parseNaturalReminder(input: string): ParsedReminderInput {
  let cleaned = input.trim();
  // Strip command prefix if any
  cleaned = cleaned.replace(/^\/remind\s+/i, '');

  let recurrence: RecurrenceType = 'none';
  let priority: Priority = 'p2';
  let category = 'personal';

  if (/every\s*day|daily/i.test(cleaned)) {
    recurrence = 'daily';
    cleaned = cleaned.replace(/every\s*day|daily/gi, '').trim();
  } else if (/weekdays|mon-fri/i.test(cleaned)) {
    recurrence = 'weekdays';
    cleaned = cleaned.replace(/weekdays|mon-fri/gi, '').trim();
  } else if (/every\s*week|weekly/i.test(cleaned)) {
    recurrence = 'weekly';
    cleaned = cleaned.replace(/every\s*week|weekly/gi, '').trim();
  }

  // Detect category keywords
  if (/office|work|meeting|project|client|call|code|presentation|standup/i.test(cleaned)) {
    category = 'work';
  } else if (/gym|workout|doctor|medicine|water|health|run|yoga|walk/i.test(cleaned)) {
    category = 'health';
  } else if (/bill|pay|bank|tax|salary|invoice|finance|subscription/i.test(cleaned)) {
    category = 'finance';
  } else if (/study|exam|course|read|homework|book|class/i.test(cleaned)) {
    category = 'study';
  } else if (/urgent|asap|emergency|crucial/i.test(cleaned)) {
    priority = 'p1';
    category = 'urgent';
  }

  // Check for priority marks
  if (/!urgent|!high|!p1/i.test(cleaned)) {
    priority = 'p1';
    cleaned = cleaned.replace(/!urgent|!high|!p1/gi, '').trim();
  }

  // Date/Time Parsing
  const now = new Date();
  let targetDate = new Date(now);

  // Check for "tomorrow"
  if (/tomorrow/i.test(cleaned)) {
    targetDate.setDate(targetDate.getDate() + 1);
    cleaned = cleaned.replace(/tomorrow/gi, '').trim();
  }

  // Look for time like: 7:00 AM, 7:00am, 7am, 19:30, 7:00, etc.
  const timeRegex = /(?:at\s+)?(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const match = cleaned.match(timeRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridian = match[3] ? match[3].toLowerCase() : null;

    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }

    targetDate.setHours(hours, minutes, 0, 0);

    // If time is earlier than current time today and no day was specified, schedule for tomorrow or next recurrence
    if (targetDate.getTime() <= now.getTime() && !/tomorrow/i.test(input)) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Remove the time portion from the title
    cleaned = cleaned.replace(match[0], '').replace(/^at\s+/i, '').trim();
  } else {
    // Default to 1 hour from now
    targetDate = new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Clean title
  let title = cleaned.replace(/^(remind me to|remind me|reminder to|todo)\s+/i, '').trim();
  if (!title) {
    title = 'Reminder';
  }

  return {
    title,
    dueDate: targetDate.toISOString(),
    recurrence,
    priority,
    category
  };
}
