import React from 'react';
import { BaseCardComponent, BaseCardState } from '../base/BaseCardComponent';
import { CalendarEvent } from 'shared';

export interface CourseCardProps {
  event: CalendarEvent;
  isHoveredGlobally: boolean;
  onHover: (id: string, isEntering: boolean) => void;
  onClick: (event: CalendarEvent) => void;
  style?: React.CSSProperties;
}

export class CourseCard extends BaseCardComponent<CourseCardProps, BaseCardState> {
  constructor(props: CourseCardProps) {
    super(props);
    this.state = { isHovered: false, isFocused: false };
  }

  handleCustomMouseEnter = (e: React.MouseEvent<HTMLDivElement>): void => {
    this.handleMouseEnter(e);
    this.props.onHover(this.props.event.id, true);
  };

  handleCustomMouseLeave = (e: React.MouseEvent<HTMLDivElement>): void => {
    this.handleMouseLeave(e);
    this.props.onHover(this.props.event.id, false);
  };

  handleCustomClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    this.props.onClick(this.props.event);
  };

  render() {
    const { event, isHoveredGlobally, style } = this.props;
    const { isHovered } = this.state;
    const activeHover = isHovered || isHoveredGlobally;

    const isMajor = event.type === 'MAJOR';
    const isGE = event.type === 'GE';
    const isGoogle = event.type === 'GOOGLE_CALENDAR_BUSY';

    let cardBg = 'bg-[#E0F7FA] border-[#00B4DB] text-[#003C6C]';
    if (isGE) {
      cardBg = 'bg-[#FFEBEB] border-[#FF6B6B] text-[#7A1D1D]';
    } else if (isGoogle) {
      cardBg = 'bg-[#FFFDE7] border-[#F9CA24] text-[#7A6100]';
    }

    return (
      <div
        style={style}
        onMouseEnter={this.handleCustomMouseEnter}
        onMouseLeave={this.handleCustomMouseLeave}
        onClick={this.handleCustomClick}
        className={`absolute inset-x-1 p-2 rounded-lg border text-left cursor-pointer transition-all duration-200 z-10 overflow-hidden ${cardBg} ${
          activeHover ? 'shadow-lg scale-[1.02] ring-2 ring-offset-1 z-30' : 'shadow-sm opacity-95'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs truncate">{event.title}</span>
        </div>
        <div className="text-[11px] opacity-80 mt-0.5 flex items-center justify-between">
          <span>{event.startTime} - {event.endTime}</span>
          {event.location && <span className="truncate max-w-[80px]">{event.location}</span>}
        </div>
      </div>
    );
  }
}

