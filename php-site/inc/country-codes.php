<?php

const DEFAULT_DIAL_CODE = '+27';

function country_codes(): array
{
    static $codes = null;
    if ($codes !== null) {
        return $codes;
    }

    $codes = [
        ['iso' => 'ZA', 'name' => 'South Africa', 'dialCode' => '+27'],
        ['iso' => 'BW', 'name' => 'Botswana', 'dialCode' => '+267'],
        ['iso' => 'LS', 'name' => 'Lesotho', 'dialCode' => '+266'],
        ['iso' => 'MZ', 'name' => 'Mozambique', 'dialCode' => '+258'],
        ['iso' => 'NA', 'name' => 'Namibia', 'dialCode' => '+264'],
        ['iso' => 'SZ', 'name' => 'Eswatini', 'dialCode' => '+268'],
        ['iso' => 'ZW', 'name' => 'Zimbabwe', 'dialCode' => '+263'],
        ['iso' => 'ZM', 'name' => 'Zambia', 'dialCode' => '+260'],
        ['iso' => 'GB', 'name' => 'United Kingdom', 'dialCode' => '+44'],
        ['iso' => 'US', 'name' => 'United States', 'dialCode' => '+1'],
        ['iso' => 'CA', 'name' => 'Canada', 'dialCode' => '+1'],
        ['iso' => 'AU', 'name' => 'Australia', 'dialCode' => '+61'],
        ['iso' => 'NZ', 'name' => 'New Zealand', 'dialCode' => '+64'],
        ['iso' => 'DE', 'name' => 'Germany', 'dialCode' => '+49'],
        ['iso' => 'FR', 'name' => 'France', 'dialCode' => '+33'],
        ['iso' => 'NL', 'name' => 'Netherlands', 'dialCode' => '+31'],
        ['iso' => 'BE', 'name' => 'Belgium', 'dialCode' => '+32'],
        ['iso' => 'CH', 'name' => 'Switzerland', 'dialCode' => '+41'],
        ['iso' => 'IT', 'name' => 'Italy', 'dialCode' => '+39'],
        ['iso' => 'ES', 'name' => 'Spain', 'dialCode' => '+34'],
        ['iso' => 'PT', 'name' => 'Portugal', 'dialCode' => '+351'],
        ['iso' => 'IE', 'name' => 'Ireland', 'dialCode' => '+353'],
        ['iso' => 'IN', 'name' => 'India', 'dialCode' => '+91'],
        ['iso' => 'CN', 'name' => 'China', 'dialCode' => '+86'],
        ['iso' => 'JP', 'name' => 'Japan', 'dialCode' => '+81'],
        ['iso' => 'AE', 'name' => 'United Arab Emirates', 'dialCode' => '+971'],
        ['iso' => 'SA', 'name' => 'Saudi Arabia', 'dialCode' => '+966'],
        ['iso' => 'KE', 'name' => 'Kenya', 'dialCode' => '+254'],
        ['iso' => 'NG', 'name' => 'Nigeria', 'dialCode' => '+234'],
        ['iso' => 'GH', 'name' => 'Ghana', 'dialCode' => '+233'],
        ['iso' => 'BR', 'name' => 'Brazil', 'dialCode' => '+55'],
        ['iso' => 'MX', 'name' => 'Mexico', 'dialCode' => '+52'],
        ['iso' => 'AR', 'name' => 'Argentina', 'dialCode' => '+54'],
    ];

    return $codes;
}

function country_codes_by_dial_length(): array
{
    $codes = country_codes();
    usort($codes, static function (array $a, array $b): int {
        $aLen = strlen(preg_replace('/\D/', '', $a['dialCode']) ?? '');
        $bLen = strlen(preg_replace('/\D/', '', $b['dialCode']) ?? '');
        return $bLen <=> $aLen;
    });
    return $codes;
}

function find_country_by_dial_code(string $dialCode): ?array
{
    foreach (country_codes() as $country) {
        if ($country['dialCode'] === $dialCode) {
            return $country;
        }
    }
    return null;
}

function filter_countries(string $query): array
{
    $q = strtolower(trim($query));
    if ($q === '') {
        return country_codes();
    }
    return array_values(array_filter(country_codes(), static function (array $country) use ($q): bool {
        return str_contains(strtolower($country['name']), $q)
            || str_contains($country['dialCode'], $q)
            || str_contains(strtolower($country['iso']), $q);
    }));
}
