use anyhow::{Context, Result};
use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::io::BufReader;

const FALLBACK_PATH: &str = "exchange_data.json";
// Note: HTTPS requests are premium only.
const RATE_API_ENDPOINT: &str = "http://api.exchangerate.host/live";

pub async fn fetch_exchange_rates(key: &str) -> Result<ExchangeRates> {
    // Add GET params to url
    let req_str = format!("{RATE_API_ENDPOINT}?access_key={key}&source=USD");
    // Send an HTTP GET request to the URL
    let response = reqwest::get(req_str).await?;

    // Check if the request was successful
    if response.status().is_success() {
        let text = response.text().await?;
        // Response JSON has an entry for success.
        // If the API key is missing/invalid the connection appears successful,
        // but the request itself isn't. So fallback to old data below.
        let re = Regex::new("\"success\": ?true,")?;
        if re.is_match(&text) {
            // Write latest rates to file for a reasonably up-to-date fallback.
            fs::write(FALLBACK_PATH, &text)
                .context("Could not write new exchange rates to file.")?;
            // Parses the JSON response into an ExchangeRates.
            return serde_json::from_str(&text).context("Could not parse JSON response.");
        }
    }

    // Fallback
    log::error!("Failed to fetch Exchange Rates! System will rely on old data!");
    match fs::File::open(FALLBACK_PATH) {
        Ok(f) => {
            let reader = BufReader::new(f);
            serde_json::from_reader(reader).context("Could not parse fallback data.")
        }
        Err(_) => {
            log::warn!("{FALLBACK_PATH} not found. Using built-in data as a last resort.");
            serde_json::from_str(RATE_API_FALLBACK)
                .context("Could not parse built-in fallback data.")
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ExchangeRates {
    quotes: HashMap<String, f64>,
}

impl ExchangeRates {
    pub fn get_usd(&self, currency: &str, amount: &f64) -> f64 {
        // Individual quotes are labelled as their pairs.
        let js_currency = format!("USD{currency}");
        match self.quotes.get(js_currency.as_str()) {
            Some(rate) => amount / rate,
            None => {
                log::warn!("Could not find exchange rate for {}", currency);
                0.0
            }
        }
    }
}

// Collected at: 2023-10-19T23:53:48
const RATE_API_FALLBACK: &str = r#"
{
    "success": true,
    "terms": "https://currencylayer.com/terms",
    "privacy": "https://currencylayer.com/privacy",
    "timestamp": 1697759584,
    "source": "USD",
    "quotes": {
        "USDAED": 3.67297,
        "USDAFN": 75.000233,
        "USDALL": 99.850084,
        "USDAMD": 401.820198,
        "USDANG": 1.801619,
        "USDAOA": 828.999901,
        "USDARS": 349.968397,
        "USDAUD": 1.581028,
        "USDAWG": 1.8025,
        "USDAZN": 1.706186,
        "USDBAM": 1.852987,
        "USDBBD": 2.018456,
        "USDBDT": 110.214735,
        "USDBGN": 1.84818,
        "USDBHD": 0.376986,
        "USDBIF": 2845,
        "USDBMD": 1,
        "USDBND": 1.372829,
        "USDBOB": 6.907725,
        "USDBRL": 5.064298,
        "USDBSD": 0.999659,
        "USDBTC": 3.4846753e-05,
        "USDBTN": 83.240281,
        "USDBWP": 13.760368,
        "USDBYN": 3.292989,
        "USDBYR": 19600,
        "USDBZD": 2.014998,
        "USDCAD": 1.371705,
        "USDCDF": 2565.000426,
        "USDCHF": 0.89201,
        "USDCLF": 0.034129,
        "USDCLP": 941.709764,
        "USDCNY": 7.312197,
        "USDCOP": 4259.5,
        "USDCRC": 530.083042,
        "USDCUC": 1,
        "USDCUP": 26.5,
        "USDCVE": 104.649672,
        "USDCZK": 23.2855,
        "USDDJF": 177.720164,
        "USDDKK": 7.050399,
        "USDDOP": 56.949941,
        "USDDZD": 137.580967,
        "USDEGP": 30.887598,
        "USDERN": 15,
        "USDETB": 55.409734,
        "USDEUR": 0.944603,
        "USDFJD": 2.286297,
        "USDFKP": 0.823157,
        "USDGBP": 0.82375,
        "USDGEL": 2.694985,
        "USDGGP": 0.823157,
        "USDGHS": 11.774994,
        "USDGIP": 0.823157,
        "USDGMD": 65.750185,
        "USDGNF": 8654.99968,
        "USDGTQ": 7.842766,
        "USDGYD": 210.92673,
        "USDHKD": 7.824025,
        "USDHNL": 24.760164,
        "USDHRK": 7.168957,
        "USDHTG": 133.957375,
        "USDHUF": 361.504892,
        "USDIDR": 15863,
        "USDILS": 4.04243,
        "USDIMP": 0.823157,
        "USDINR": 83.12255,
        "USDIQD": 1310,
        "USDIRR": 42262.499211,
        "USDISK": 138.220352,
        "USDJEP": 0.823157,
        "USDJMD": 155.652087,
        "USDJOD": 0.709298,
        "USDJPY": 149.819807,
        "USDKES": 149.880118,
        "USDKGS": 89.319935,
        "USDKHR": 4135.999745,
        "USDKMF": 465.875051,
        "USDKPW": 899.934101,
        "USDKRW": 1359.098106,
        "USDKWD": 0.309201,
        "USDKYD": 0.833069,
        "USDKZT": 479.817335,
        "USDLAK": 20704.999856,
        "USDLBP": 15029.99998,
        "USDLKR": 324.896374,
        "USDLRD": 186.89002,
        "USDLSL": 18.939976,
        "USDLTL": 2.95274,
        "USDLVL": 0.60489,
        "USDLYD": 4.894997,
        "USDMAD": 10.3015,
        "USDMDL": 18.22385,
        "USDMGA": 4524.999948,
        "USDMKD": 58.135579,
        "USDMMK": 2099.329215,
        "USDMNT": 3467.079128,
        "USDMOP": 8.058002,
        "USDMRO": 356.999828,
        "USDMUR": 44.351828,
        "USDMVR": 15.384984,
        "USDMWK": 1153.000253,
        "USDMXN": 18.32415,
        "USDMYR": 4.764987,
        "USDMZN": 63.24995,
        "USDNAD": 18.939957,
        "USDNGN": 763.999829,
        "USDNIO": 36.669948,
        "USDNOK": 11.00329,
        "USDNPR": 133.184904,
        "USDNZD": 1.7122,
        "USDOMR": 0.384934,
        "USDPAB": 0.999635,
        "USDPEN": 3.873038,
        "USDPGK": 3.76365,
        "USDPHP": 56.726054,
        "USDPKR": 278.650052,
        "USDPLN": 4.205922,
        "USDPYG": 7426.847119,
        "USDQAR": 3.64075,
        "USDRON": 4.699103,
        "USDRSD": 110.719029,
        "USDRUB": 96.185028,
        "USDRWF": 1226,
        "USDSAR": 3.750921,
        "USDSBD": 8.422141,
        "USDSCR": 13.280032,
        "USDSDG": 600.9379,
        "USDSEK": 10.954106,
        "USDSGD": 1.372665,
        "USDSHP": 1.21675,
        "USDSLE": 22.625028,
        "USDSLL": 19749.999994,
        "USDSOS": 570.449256,
        "USDSRD": 38.182505,
        "USDSTD": 20697.981008,
        "USDSSP": 600.999892,
        "USDSYP": 13001.869046,
        "USDSZL": 18.93987,
        "USDTHB": 36.420306,
        "USDTJS": 10.971156,
        "USDTMT": 3.51,
        "USDTND": 3.165498,
        "USDTOP": 2.40255,
        "USDTRY": 28.031799,
        "USDTTD": 6.781652,
        "USDTWD": 32.363505,
        "USDTZS": 2509.999797,
        "USDUAH": 36.591993,
        "USDUGX": 3757.514318,
        "USDUYU": 39.896351,
        "USDUZS": 12244.999772,
        "USDVEF": 3477022.844504,
        "USDVES": 34.81665,
        "USDVND": 24565,
        "USDVUV": 122.701126,
        "USDWST": 2.794756,
        "USDXAF": 621.4686,
        "USDXAG": 0.043358,
        "USDXAU": 0.000506,
        "USDXCD": 2.70255,
        "USDXDR": 0.762872,
        "USDXOF": 623.000431,
        "USDXPF": 113.30406,
        "USDYER": 250.325032,
        "USDZAR": 19.018202,
        "USDZMK": 9001.196327,
        "USDZMW": 21.51807,
        "USDZWL": 321.999592
    }
}
"#;
