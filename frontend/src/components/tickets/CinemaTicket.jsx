// Cinema screening ticket — film + screen + seat info. Built on BaseTicket so
// the look matches Event/Travel/Hotel tickets. Surfaces director / cast /
// synopsis / trailer as service-specific extras.
import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Film,
  Clock,
  MapPin,
  Monitor,
  Armchair,
  Ticket,
  Calendar,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import BaseTicket from './BaseTicket';

const ACCENT = '#0891b2'; // cyan-600

export default function CinemaTicket({ order, formatDate }) {
  const { t } = useTranslation();
  const bd = order?.booking_details || {};
  const si = bd.showtime_info || {};
  const filmTitle = si.film_title || bd.film_title || order?.service_name || 'Film';
  const cinemaName = si.cinema_name || bd.cinema || order?.operator_name;
  const cinemaCity = si.cinema_city || bd.cinema_city;
  const cinemaAddress = si.cinema_address;
  const cinemaPhone = si.cinema_phone;
  const cinemaAmenities = si.cinema_amenities || [];
  const screenName = si.screen_name || bd.screen;
  const screenType = si.screen_type || bd.screen_type;
  const showDate = si.show_date || bd.show_date;
  const showTime = si.show_time || bd.show_time;
  const endTime = si.end_time || bd.end_time;
  const seats = bd.seats || bd.selected_seats || [];
  const counts = bd.ticket_counts || {};
  const poster = si.poster_url || bd.poster_url;
  const filmDuration = si.film_duration_minutes;
  const filmGenre = si.film_genre || [];
  const filmLanguage = si.film_language || si.language;
  const filmRating = si.film_rating;
  const filmDirector = si.film_director;
  const filmCast = si.film_cast || [];
  const filmSynopsis = si.film_synopsis;
  const filmImdb = si.film_imdb_rating;
  const filmTrailerUrl = si.film_trailer_url;

  const badges = [
    filmRating && {
      label: filmRating,
      variant: 'outline',
      className: 'bg-slate-100 border-slate-300 text-slate-700 uppercase',
    },
    screenName && {
      label: screenName,
      style: { background: ACCENT, color: '#fff' },
      icon: Monitor,
      testId: 'ticket-screen-name',
    },
    screenType && {
      label: screenType.replace('_', ' '),
      variant: 'outline',
      className: 'uppercase tracking-wide bg-cyan-50 border-cyan-200 text-cyan-700',
    },
    seats.length > 0 && {
      label: `Seat${seats.length > 1 ? 's' : ''} ${seats.join(', ')}`,
      style: { background: '#d1fae5', color: '#047857' },
      icon: Armchair,
      testId: 'ticket-seats',
    },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: Calendar,
      label: t('common.date'),
      value: showDate && formatDate ? formatDate(showDate) : showDate || '—',
    },
    {
      icon: Clock,
      label: t('orders.showtime'),
      value: showTime ? `${showTime}${endTime ? ` – ${endTime}` : ''}` : '—',
      sublabel: filmDuration ? `${filmDuration} min` : null,
    },
    {
      icon: MapPin,
      label: t('orders.cinema'),
      value: cinemaName || '—',
      sublabel: [cinemaAddress, cinemaCity].filter(Boolean).join(' · ') || null,
    },
    {
      icon: Ticket,
      label: t('common.paid'),
      value: formatFCFA(order?.total_amount || 0),
      valueStyle: { color: ACCENT },
    },
  ];

  const subtitle = [filmDuration && `${filmDuration} min`, filmLanguage, filmImdb && `★ ${Number(filmImdb).toFixed(1)} IMDb`]
    .filter(Boolean)
    .join(' · ');

  const extraSections = (
    <>
      {filmGenre.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="ticket-film-genres">
          {filmGenre.slice(0, 4).map((g, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="text-[10px] capitalize bg-purple-50 border-purple-200 text-purple-700 px-1.5 py-0"
            >
              {(g || '').replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      )}

      {(filmDirector || filmCast.length > 0) && (
        <div
          className="pt-3 border-t border-dashed grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
          style={{ borderColor: `${ACCENT}40` }}
          data-testid="ticket-film-credits"
        >
          {filmDirector && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Director</p>
              <p className="text-slate-800 font-medium mt-0.5">{filmDirector}</p>
            </div>
          )}
          {filmCast.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Starring</p>
              <p
                className="text-slate-800 font-medium mt-0.5 truncate"
                title={filmCast.join(', ')}
              >
                {filmCast.slice(0, 4).join(', ')}{filmCast.length > 4 ? '…' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {filmSynopsis && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }} data-testid="ticket-film-synopsis">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Synopsis</p>
          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{filmSynopsis}</p>
          {filmTrailerUrl && (
            <a
              href={filmTrailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-700 hover:text-cyan-800 underline mt-1.5 inline-flex items-center gap-1"
              data-testid="ticket-film-trailer-link"
            >
              Watch trailer →
            </a>
          )}
        </div>
      )}

      {(counts.adult || counts.child || counts.senior || counts.vip) && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">Tickets</p>
          <div className="flex flex-wrap gap-1.5">
            {counts.adult > 0 && (
              <Badge variant="outline" className="text-xs bg-white border-slate-200 text-slate-700 gap-1">
                <Ticket className="h-3 w-3" /> {counts.adult} Adult{counts.adult > 1 ? 's' : ''}
              </Badge>
            )}
            {counts.child > 0 && (
              <Badge variant="outline" className="text-xs bg-white border-slate-200 text-slate-700 gap-1">
                <Ticket className="h-3 w-3" /> {counts.child} Child{counts.child > 1 ? 'ren' : ''}
              </Badge>
            )}
            {counts.senior > 0 && (
              <Badge variant="outline" className="text-xs bg-white border-slate-200 text-slate-700 gap-1">
                <Ticket className="h-3 w-3" /> {counts.senior} Senior{counts.senior > 1 ? 's' : ''}
              </Badge>
            )}
            {counts.vip > 0 && (
              <Badge className="text-xs bg-amber-400 text-amber-950 gap-1">
                <Ticket className="h-3 w-3" /> {counts.vip} VIP
              </Badge>
            )}
          </div>
        </div>
      )}
    </>
  );

  const rules = [
    cinemaPhone && `Cinema support: ${cinemaPhone}`,
    cinemaAmenities.length > 0 && `Amenities: ${cinemaAmenities.slice(0, 6).map((a) => (a || '').replace(/_/g, ' ')).join(', ')}`,
    'Arrive 15 minutes before showtime.',
  ].filter(Boolean);

  return (
    <BaseTicket
      testId="cinema-ticket"
      accentColor={ACCENT}
      posterSrc={poster}
      posterAlt={filmTitle}
      posterAspect="portrait"
      PosterFallbackIcon={Film}
      posterFallbackBg="bg-gradient-to-br from-red-700 to-rose-600"
      posterFallbackIconColor="text-white/80"
      badges={badges}
      title={filmTitle}
      subtitle={subtitle}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle={t("orders.cinema_info")}
      rightPanelDescription={t("orders.cinema_present_at_entrance")}
      rulesTitle={t("orders.notes")}
      rules={rules}
    />
  );
}
