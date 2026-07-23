import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, ChevronDown, Edit3, ListFilter, Check } from 'lucide-react';
import { THAI_PROVINCES } from '../data/thailandAddressData';

interface ThaiAddressSelectorProps {
  province: string;
  district: string;
  subdistrict: string;
  onProvinceChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onSubdistrictChange: (value: string) => void;
  disabled?: boolean;
}

export const ThaiAddressSelector: React.FC<ThaiAddressSelectorProps> = ({
  province,
  district,
  subdistrict,
  onProvinceChange,
  onDistrictChange,
  onSubdistrictChange,
  disabled = false,
}) => {
  const [isManualMode, setIsManualMode] = useState(false);

  // Find currently selected province object
  const currentProvinceData = useMemo(() => {
    if (!province) return null;
    return THAI_PROVINCES.find(
      (p) => p.name === province || p.name.includes(province) || province.includes(p.name)
    );
  }, [province]);

  // Find available districts for current province
  const availableDistricts = useMemo(() => {
    if (!currentProvinceData) return [];
    return currentProvinceData.districts;
  }, [currentProvinceData]);

  // Find currently selected district object
  const currentDistrictData = useMemo(() => {
    if (!district || !availableDistricts.length) return null;
    return availableDistricts.find(
      (d) => d.name === district || d.name.includes(district) || district.includes(d.name)
    );
  }, [district, availableDistricts]);

  // Find available subdistricts
  const availableSubdistricts = useMemo(() => {
    if (!currentDistrictData) return [];
    return currentDistrictData.subdistricts.map((s) => (typeof s === 'string' ? s : s.name));
  }, [currentDistrictData]);

  // Handle province selection change
  const handleSelectProvince = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onProvinceChange(val);
    // Reset district & subdistrict when province changes
    onDistrictChange('');
    onSubdistrictChange('');
  };

  // Handle district selection change
  const handleSelectDistrict = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onDistrictChange(val);
    // Reset subdistrict when district changes
    onSubdistrictChange('');
  };

  // Handle subdistrict selection change
  const handleSelectSubdistrict = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onSubdistrictChange(val);
  };

  // Quick select helper for popular provinces
  const quickProvinces = ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "ชลบุรี", "เชียงใหม่", "ภูเก็ต"];

  return (
    <div className="space-y-3 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200/80">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <MapPin size={14} className="text-blue-600" />
          ระบุที่อยู่ / พื้นที่การซ่อมบำรุง
        </span>
        <button
          type="button"
          onClick={() => setIsManualMode(!isManualMode)}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
        >
          {isManualMode ? (
            <>
              <ListFilter size={12} />
              <span>เลือกจากรายการ</span>
            </>
          ) : (
            <>
              <Edit3 size={12} />
              <span>พิมพ์เอง</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Select Buttons (When in list mode) */}
      {!isManualMode && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
          <span className="text-slate-400 font-medium whitespace-nowrap">ยอดนิยม:</span>
          {quickProvinces.map((prov) => {
            const isSelected = province === prov;
            return (
              <button
                key={prov}
                type="button"
                onClick={() => {
                  onProvinceChange(prov);
                  onDistrictChange('');
                  onSubdistrictChange('');
                }}
                className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                {prov === "กรุงเทพมหานคร" ? "กรุงเทพฯ" : prov}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Address Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Province Field */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 block">
            จังหวัด
          </label>
          {isManualMode ? (
            <input
              type="text"
              placeholder="เช่น กรุงเทพมหานคร, ชลบุรี"
              value={province}
              onChange={(e) => onProvinceChange(e.target.value)}
              disabled={disabled}
              className="w-full text-[15px] sm:text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs active:scale-[0.99] transition-all"
            />
          ) : (
            <div className="relative">
              <select
                value={province}
                onChange={handleSelectProvince}
                disabled={disabled}
                className="w-full text-[15px] sm:text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] pr-9 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 appearance-none cursor-pointer shadow-2xs active:scale-[0.99] transition-all"
              >
                <option value="">-- เลือกจังหวัด --</option>
                {THAI_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}
        </div>

        {/* District Field */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 block">
            อำเภอ / เขต
          </label>
          {isManualMode ? (
            <input
              type="text"
              placeholder="เช่น ปทุมวัน, บางละมุง"
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              disabled={disabled}
              className="w-full text-[15px] sm:text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs active:scale-[0.99] transition-all"
            />
          ) : (
            <div className="relative">
              <select
                value={district}
                onChange={handleSelectDistrict}
                disabled={disabled || !province}
                className="w-full text-[15px] sm:text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] pr-9 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 appearance-none cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
              >
                <option value="">
                  {!province ? '-- เลือกจังหวัดก่อน --' : '-- เลือกลำดับถัดไป --'}
                </option>
                {availableDistricts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}
        </div>

        {/* Sub-district Field */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 block">
            ตำบล / แขวง
          </label>
          {isManualMode ? (
            <input
              type="text"
              placeholder="เช่น ลุมพินี, หนองปรือ"
              value={subdistrict}
              onChange={(e) => onSubdistrictChange(e.target.value)}
              disabled={disabled}
              className="w-full text-[15px] sm:text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs active:scale-[0.99] transition-all"
            />
          ) : (
            <div className="relative">
              <select
                value={subdistrict}
                onChange={handleSelectSubdistrict}
                disabled={disabled || !district}
                className="w-full text-[15px] sm:text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] pr-9 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-medium text-slate-800 appearance-none cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
              >
                <option value="">
                  {!district ? '-- เลือกอำเภอ/เขตก่อน --' : '-- เลือกตำบล/แขวง --'}
                </option>
                {availableSubdistricts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
