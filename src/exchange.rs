use anyhow::Context;
use serde::Deserialize;
use std::collections::HashMap;

const RATE_API_ENDPOINT: &str =
    "https://api.exchangerate.host/latest?access_key=a0e57ecae9d3f9a91c541829558f262f
&base=USD";

pub async fn fetch_exchange_rates() -> Result<ExchangeRates, anyhow::Error> {
    // Send an HTTP GET request to the URL
    let response = reqwest::get(RATE_API_ENDPOINT).await?;

    // Check if the request was successful
    if response.status().is_success() {
        let text = response.text().await?;
        // Response JSON has an entry for success.
        // If the API key is missing/invalid the connection appears successful,
        // but the request itself isn't. So fallback to old data below.
        if text.contains("\"success\": true,") {
            // Parses the JSON response into an ExchangeRates.
            return serde_json::from_str(&text).context("Could not parse JSON response.");
        }
    }

    // Fallback
    log::error!("Failed to fetch Exchange Rates! System will rely on old data!");
    Ok(serde_json::from_str(RATE_API_FALLBACK)?)
}

#[derive(Debug, Deserialize)]
pub struct ExchangeRates {
    rates: HashMap<String, f64>,
}

impl ExchangeRates {
    pub fn get_usd(&self, currency: &str, amount: &f64) -> f64 {
        match self.rates.get(currency) {
            Some(rate) => amount / rate,
            None => {
                log::warn!("Could not find exchange rate for {}", currency);
                0.0
            }
        }
    }
}

const RATE_API_FALLBACK: &str = r#"
{
    "motd": {
      "msg": "If you or your company use this project or like what we doing, please consider backing us so we can continue maintaining and evolving this project.",
      "url": "https://exchangerate.host/#/donate"
    },
    "success": true,
    "base": "USD",
    "date": "2023-09-04",
    "rates": {
      "AED": 3.672988,
      "AFN": 73.364374,
      "ALL": 99.874706,
      "AMD": 385.721537,
      "ANG": 1.801915,
      "AOA": 824.784896,
      "ARS": 349.391745,
      "AUD": 1.548711,
      "AWG": 1.800024,
      "AZN": 1.700358,
      "BAM": 1.80302,
      "BBD": 1.999944,
      "BDT": 109.230547,
      "BGN": 1.814795,
      "BHD": 0.376422,
      "BIF": 2829.918623,
      "BMD": 1.000558,
      "BND": 1.35033,
      "BOB": 6.908606,
      "BRL": 4.943911,
      "BSD": 1.0002,
      "BTC": 0.000039,
      "BTN": 82.7302,
      "BWP": 13.502407,
      "BYN": 2.523582,
      "BZD": 2.015896,
      "CAD": 1.357885,
      "CDF": 2480.492783,
      "CHF": 0.88604,
      "CLF": 0.031235,
      "CLP": 853.097634,
      "CNH": 7.265874,
      "CNY": 7.260356,
      "COP": 4089.889339,
      "CRC": 539.051502,
      "CUC": 1.00064,
      "CUP": 25.743435,
      "CVE": 101.640133,
      "CZK": 22.351855,
      "DJF": 177.782017,
      "DKK": 6.914018,
      "DOP": 56.75347,
      "DZD": 136.70713,
      "EGP": 30.855698,
      "ERN": 14.996703,
      "ETB": 55.244935,
      "EUR": 0.927374,
      "FJD": 2.25972,
      "FKP": 0.794482,
      "GBP": 0.794952,
      "GEL": 2.628796,
      "GGP": 0.794293,
      "GHS": 11.427894,
      "GIP": 0.794417,
      "GMD": 60.797325,
      "GNF": 8585.464555,
      "GTQ": 7.869259,
      "GYD": 209.178797,
      "HKD": 7.842024,
      "HNL": 24.620262,
      "HRK": 6.99148,
      "HTG": 135.574425,
      "HUF": 356.398263,
      "IDR": 15230.093719,
      "ILS": 3.795445,
      "IMP": 0.794336,
      "INR": 82.702265,
      "IQD": 1309.374504,
      "IRR": 42238.936793,
      "ISK": 131.881783,
      "JEP": 0.794391,
      "JMD": 154.250141,
      "JOD": 0.708183,
      "JPY": 146.173002,
      "KES": 145.080656,
      "KGS": 88.235349,
      "KHR": 4158.099085,
      "KMF": 456.47787,
      "KPW": 899.76496,
      "KRW": 1318.88694,
      "KWD": 0.3085,
      "KYD": 0.833468,
      "KZT": 457.484121,
      "LAK": 19680.221622,
      "LBP": 15026.969567,
      "LKR": 319.937017,
      "LRD": 185.948511,
      "LSL": 18.724215,
      "LYD": 4.814954,
      "MAD": 10.219864,
      "MDL": 17.806219,
      "MGA": 4512.965509,
      "MKD": 56.957775,
      "MMK": 2099.606443,
      "MNT": 3449.096973,
      "MOP": 8.080047,
      "MRU": 37.977844,
      "MUR": 45.415257,
      "MVR": 15.396118,
      "MWK": 1068.79398,
      "MXN": 17.088299,
      "MYR": 4.647095,
      "MZN": 63.814256,
      "NAD": 18.828956,
      "NGN": 767.909654,
      "NIO": 36.585514,
      "NOK": 10.66337,
      "NPR": 132.367557,
      "NZD": 1.680906,
      "OMR": 0.384728,
      "PAB": 1.000748,
      "PEN": 3.693622,
      "PGK": 3.660013,
      "PHP": 56.774399,
      "PKR": 306.174185,
      "PLN": 4.145781,
      "PYG": 7276.47467,
      "QAR": 3.646249,
      "RON": 4.585888,
      "RSD": 108.755992,
      "RUB": 96.385921,
      "RWF": 1189.730002,
      "SAR": 3.749031,
      "SBD": 8.367424,
      "SCR": 13.207753,
      "SDG": 601.342641,
      "SEK": 11.038348,
      "SGD": 1.353488,
      "SHP": 0.794806,
      "SLL": 20964.009067,
      "SOS": 569.377544,
      "SRD": 38.190754,
      "SSP": 130.226984,
      "STD": 22275.965364,
      "STN": 22.583202,
      "SVC": 8.749067,
      "SYP": 2511.872752,
      "SZL": 18.714493,
      "THB": 35.206569,
      "TJS": 10.983359,
      "TMT": 3.503568,
      "TND": 3.092997,
      "TOP": 2.384139,
      "TRY": 26.702038,
      "TTD": 6.79401,
      "TWD": 31.86886,
      "TZS": 2504.408587,
      "UAH": 36.925785,
      "UGX": 3718.452218,
      "USD": 1,
      "UYU": 37.655179,
      "UZS": 12099.163757,
      "VES": 32.660395,
      "VND": 24078.593795,
      "VUV": 118.691474,
      "WST": 2.718642,
      "XAF": 607.858466,
      "XAG": 0.041993,
      "XAU": 0.001035,
      "XCD": 2.702597,
      "XDR": 0.753496,
      "XOF": 607.85795,
      "XPD": 0.001511,
      "XPF": 110.582109,
      "XPT": 0.001495,
      "YER": 250.182821,
      "ZAR": 18.832961,
      "ZMW": 20.221455,
      "ZWL": 321.91663
    }
}"#;
