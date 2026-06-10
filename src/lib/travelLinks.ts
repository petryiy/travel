export const IATA_CITIES: Record<string, string> = {
  'tokyo': 'TYO',
  'osaka': 'OSA',
  'kyoto': 'UKY',
  'paris': 'PAR',
  'london': 'LON',
  'new york': 'NYC',
  'los angeles': 'LAX',
  'chicago': 'CHI',
  'miami': 'MIA',
  'san francisco': 'SFO',
  'toronto': 'YTO',
  'vancouver': 'YVR',
  'montreal': 'YMQ',
  'sydney': 'SYD',
  'melbourne': 'MEL',
  'brisbane': 'BNE',
  'auckland': 'AKL',
  'singapore': 'SIN',
  'hong kong': 'HKG',
  'bangkok': 'BKK',
  'bali': 'DPS',
  'jakarta': 'JKT',
  'kuala lumpur': 'KUL',
  'seoul': 'SEL',
  'beijing': 'BJS',
  'shanghai': 'SHA',
  'dubai': 'DXB',
  'abu dhabi': 'AUH',
  'istanbul': 'IST',
  'amsterdam': 'AMS',
  'berlin': 'BER',
  'munich': 'MUC',
  'frankfurt': 'FRA',
  'rome': 'ROM',
  'milan': 'MIL',
  'barcelona': 'BCN',
  'madrid': 'MAD',
  'lisbon': 'LIS',
  'vienna': 'VIE',
  'zurich': 'ZRH',
  'geneva': 'GVA',
  'brussels': 'BRU',
  'stockholm': 'STO',
  'oslo': 'OSL',
  'copenhagen': 'CPH',
  'helsinki': 'HEL',
  'prague': 'PRG',
  'budapest': 'BUD',
  'warsaw': 'WAW',
  'athens': 'ATH',
  'cairo': 'CAI',
  'nairobi': 'NBO',
  'cape town': 'CPT',
  'johannesburg': 'JNB',
  'casablanca': 'CAS',
  'mumbai': 'BOM',
  'delhi': 'DEL',
  'new delhi': 'DEL',
  'bangalore': 'BLR',
  'chennai': 'MAA',
  'kolkata': 'CCU',
  'karachi': 'KHI',
  'lahore': 'LHE',
  'dhaka': 'DAC',
  'colombo': 'CMB',
  'kathmandu': 'KTM',
  'mexico city': 'MEX',
  'cancun': 'CUN',
  'bogota': 'BOG',
  'lima': 'LIM',
  'buenos aires': 'BUE',
  'santiago': 'SCL',
  'sao paulo': 'SAO',
  'rio de janeiro': 'RIO',
  'havana': 'HAV',
  'san jose': 'SJO',
  'panama city': 'PTY',
  'reykjavik': 'REK',
  'dublin': 'DUB',
  'manchester': 'MAN',
  'seattle': 'SEA',
  'boston': 'BOS',
  'washington': 'WAS',
  'washington dc': 'WAS',
  'dallas': 'DFW',
  'houston': 'HOU',
  'phoenix': 'PHX',
  'denver': 'DEN',
  'las vegas': 'LAS',
  'orlando': 'ORL',
  'atlanta': 'ATL',
  'minneapolis': 'MSP',
  'portland': 'PDX',
  'philadelphia': 'PHL',
  'detroit': 'DTT',
  'honolulu': 'HNL',
  'anchorage': 'ANC',
  'calgary': 'YYC',
  'ottawa': 'YOW',
  'edinburgh': 'EDI',
}

export function cityToIata(name: string): string | null {
  return IATA_CITIES[name.toLowerCase().trim()] ?? null
}

function fmtYYMMDD(date: string): string {
  return date.replace(/-/g, '').slice(2)
}

function fmtMMDDYYYY(date: string): string {
  const [y, m, d] = date.split('-')
  return `${m}${d}${y}`
}

export function buildBookingComUrl(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): string {
  const params = new URLSearchParams({
    ss: destination,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: String(guests),
  })
  return `https://www.booking.com/searchresults.html?${params.toString()}`
}

export function buildGoogleHotelsUrl(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): string {
  const dates = `${fmtMMDDYYYY(checkIn)},${fmtMMDDYYYY(checkOut)}`
  const params = new URLSearchParams({
    q: `hotels in ${destination}`,
    dates,
    num_adults: String(guests),
  })
  return `https://www.google.com/travel/hotels/${encodeURIComponent(destination)}?${params.toString()}`
}

export function buildSkyscannerUrl(
  originCode: string,
  destCode: string,
  departure: string,
  returnDate: string | null,
  passengers: number,
): string {
  const dep = fmtYYMMDD(departure)
  const ret = returnDate ? fmtYYMMDD(returnDate) : dep
  return `https://www.skyscanner.net/transport/flights/${originCode.toLowerCase()}/${destCode.toLowerCase()}/${dep}/${ret}/?adults=${passengers}`
}

export function buildGoogleFlightsUrl(
  originCode: string,
  destCode: string,
  departure: string,
  returnDate: string | null,
  passengers: number,
): string {
  const pax = passengers > 1 ? `;p:${passengers}` : ''
  if (returnDate) {
    return `https://www.google.com/flights?hl=en#flt=${originCode}.${destCode}.${departure}*${destCode}.${originCode}.${returnDate}${pax};c:USD;e:1;sd:1;t:f`
  }
  return `https://www.google.com/flights?hl=en#flt=${originCode}.${destCode}.${departure}${pax};c:USD;e:1;sd:1;t:f`
}
