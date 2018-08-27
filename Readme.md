# Overview
Google spreadsheet helper. Extends the basic functionality with
- import files (CSV atm) with custom mapping into exisitng tab(s) by appling (one) merging strategies;
- TBD find and collapse duplicate rows

# Limitation
# System level
## Google Sheet data format
Depends on the document Locale that is why during reading value formats differs and may be unexpected by a reader.

### Date
#### Locales
Since all parsing and transfomation happen witin JS, it may be a big problem for a reader since JS cannot undestand (Date.parse or new Date) many formats, e.g.
09.10.2003 (9 Oct 2003) in Russian locale will be treated as 09/10/2003 (10 Sep 2003) in US locale.

# App level
## Known issues
- (not always) copy the last row of an uploading
- respect time zones. If you change the initial (when a doc created) timezone then during reading dates will be modified to this new timezone with the offset diffirence.

## TODOs
- fixing, extending hash caluclation
-- tollerance level for dates. Due to hardness of time value handling it is possible and acceptable that dates may differ for the same transaction.
-- UPPER and lower cases should be ignored for hashing
- mappings kept in one or tabs in the sheet