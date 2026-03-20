import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { systemApi } from '../api';

export interface CountryOption {
  countryCode: string;
  countryName: string;
  countryNameEn?: string;
  cities: Array<{
    cityCode: string;
    cityName: string;
    cityNameEn?: string;
  }>;
}

export interface BaseOption {
  code: string;
  label: string;
  labelEn?: string;
  transportMode: 'ALL' | 'SEA' | 'AIR';
  extra?: any;
}

const BASE_OPTION_TYPES = [
  'ORDER_SERVICE_TYPE',
  'PAYMENT_METHOD',
  'PAYMENT_CHANNEL',
  'CONTAINER_TYPE',
  'EXPRESS_COMPANY',
  'CARGO_CATEGORY',
  'CARGO_TYPE',
  'FEE_TYPE',
  'ORDER_REMARK_TAG',
  'CARRIER',
] as const;

type BaseOptionType = typeof BASE_OPTION_TYPES[number];

type BaseOptionMap = Record<BaseOptionType, BaseOption[]>;

function emptyOptionMap(): BaseOptionMap {
  return {
    ORDER_SERVICE_TYPE: [],
    PAYMENT_METHOD: [],
    PAYMENT_CHANNEL: [],
    CONTAINER_TYPE: [],
    EXPRESS_COMPANY: [],
    CARGO_CATEGORY: [],
    CARGO_TYPE: [],
    FEE_TYPE: [],
    ORDER_REMARK_TAG: [],
    CARRIER: [],
  };
}

export function useOrderBaseOptions() {
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [baseOptions, setBaseOptions] = useState<BaseOptionMap>(emptyOptionMap());
  const [currencyOptions, setCurrencyOptions] = useState<BaseOption[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [countryRes, baseRes, exchangeRes] = await Promise.all([
        systemApi.listCountries({ status: 'ACTIVE' }) as Promise<any>,
        systemApi.listBaseDataOptions({ types: BASE_OPTION_TYPES.join(',') }) as Promise<any>,
        systemApi.exchangeRates() as Promise<any>,
      ]);

      const countryRows = Array.isArray(countryRes?.data) ? countryRes.data : [];
      const countryOptions: CountryOption[] = countryRows
        .map((country: any) => ({
          countryCode: String(country.countryCode || '').trim().toUpperCase(),
          countryName: String(country.countryName || ''),
          countryNameEn: country.countryNameEn || undefined,
          cities: (Array.isArray(country.cities) ? country.cities : [])
            .filter((city: any) => String(city.status || 'ACTIVE') === 'ACTIVE')
            .map((city: any) => ({
              cityCode: String(city.cityCode || '').trim().toUpperCase(),
              cityName: String(city.cityName || ''),
              cityNameEn: city.cityNameEn || undefined,
            })),
        }))
        .filter((item: CountryOption) => item.countryCode && item.countryName)
        .sort((a: CountryOption, b: CountryOption) => a.countryName.localeCompare(b.countryName));
      setCountries(countryOptions);

      const optionMap = emptyOptionMap();
      const optionData = baseRes?.data || {};
      BASE_OPTION_TYPES.forEach((type) => {
        const rows = Array.isArray(optionData[type]) ? optionData[type] : [];
        optionMap[type] = rows.map((row: any) => ({
          code: String(row.dataCode || ''),
          label: String(row.dataName || ''),
          labelEn: row.dataNameEn || undefined,
          transportMode: (row.transportMode || 'ALL') as 'ALL' | 'SEA' | 'AIR',
          extra: row.extra || null,
        })).filter((item: BaseOption) => item.code && item.label);
      });
      setBaseOptions(optionMap);

      const currencies = Array.isArray(exchangeRes?.data?.currencies) ? exchangeRes.data.currencies : [];
      setCurrencyOptions(
        currencies
          .filter((row: any) => String(row.status || 'ACTIVE') === 'ACTIVE')
          .map((row: any) => ({
            code: String(row.currencyCode || '').toUpperCase(),
            label: `${row.currencyName || row.currencyCode} (${String(row.currencyCode || '').toUpperCase()})`,
            labelEn: row.currencyNameEn || undefined,
            transportMode: 'ALL' as const,
            extra: {
              symbol: row.symbol,
              manualRate: row.manualRate,
              liveRate: row.liveRate,
            },
          }))
      );
    } catch (err: any) {
      message.error(err.message || '加载订单基础数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const countryCodeNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    countries.forEach((country) => {
      map[country.countryCode] = country.countryName;
    });
    return map;
  }, [countries]);

  return {
    loading,
    countries,
    baseOptions,
    currencyOptions,
    countryCodeNameMap,
    refresh,
  };
}
