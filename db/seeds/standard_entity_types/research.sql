INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
(
  'doi', 'Digital Object Identifier', 'research',
  'Persistent identifier for a digital document or publication',
  ARRAY['10.1038/nature12373', '10.1016/j.cell.2023.01.001', 'doi:10.1145/3442188.3445922'],
  'Format: 10.NNNN/suffix where NNNN is the registrant code and suffix is the item identifier',
   'alphanumeric', '^10\.\d{4,9}/[^\s]+$', NULL, TRUE
),
(
  'arxiv', 'arXiv Identifier', 'research',
  'Identifier for a preprint paper hosted on the arXiv repository',
  ARRAY['arXiv:2303.08774', '1706.03762', 'arXiv:1605.02688v2'],
  'Format: YYMM.NNNNN or YYMM.NNNNNvN for versioned papers; optionally prefixed with arXiv:',
  'alphanumeric', '\d{4}\.\d{4,5}(v\d+)?', NULL, TRUE
),
(
  'author', 'Author Name', 'research',
  'Name of a person who created or contributed to a published work',
  ARRAY['Smith, J.', 'John A. Smith', 'Smith et al.'],
   'May appear in Last, First or First Last format; may include initials or ''et al.'' for multiple authors',
   'alphanumeric', NULL, NULL, FALSE
),
(
  'institution', 'Research Institution', 'research',
  'Name of an academic or research organization affiliated with a publication',
  ARRAY['Massachusetts Institute of Technology', 'Stanford University', 'NIH'],
   'Full or abbreviated name of a university, research lab, hospital, or government agency',
   'alphanumeric', NULL, NULL, FALSE
),
(
  'citation', 'Citation', 'research',
  'Reference to a published work in a standard bibliographic format',
  ARRAY['Smith et al. (2023). Nature, 612, 45-52.', '[1] J. Smith, "Title," Journal, vol. 1, 2023.'],
  'May follow APA, MLA, Chicago, IEEE, or other citation styles; includes author, title, publication, and year',
  NULL, NULL, NULL, FALSE
),
(
  'issn', 'International Standard Serial Number', 'research',
  '8-digit code identifying a serial publication such as a journal or magazine',
  ARRAY['ISSN 1234-5678', '0028-0836', 'ISSN: 2041-1723'],
  '8 digits formatted as NNNN-NNNX where X may be 0-9 or X (check digit)',
  'alphanumeric', '\d{4}-\d{3}[\dX]', 8, TRUE
),
(
  'isbn', 'International Standard Book Number', 'research',
  'Unique numeric identifier for a published book',
  ARRAY['ISBN 978-0-306-40615-7', '0-306-40615-2', 'ISBN-13: 9780306406157'],
  '13 digits (ISBN-13) or 10 digits (ISBN-10), grouped with hyphens; final digit may be X for ISBN-10',
  'alphanumeric', '(?:97[89]-?)?\d{1,5}-?\d{1,7}-?\d{1,6}-?[\dX]', NULL, TRUE
),
(
  'grant_num', 'Grant Number', 'research',
  'Identifier assigned to a research funding grant by the awarding agency',
  ARRAY['R01 CA123456', 'NSF 2012345', '5R01GM123456-03'],
  'Alphanumeric code assigned by funding agency; NIH grants follow activity-IC-serial format',
  'alphanumeric', NULL, NULL, FALSE
),
(
  'vol', 'Volume Number', 'research',
  'Volume number of a journal or multi-volume publication',
  ARRAY['Vol. 42', 'Volume 10', 'vol. 3'],
  'Integer typically preceded by ''Vol.'' or ''Volume'' label',
  'int', NULL, NULL, FALSE
),
(
  'issue', 'Issue Number', 'research',
  'Issue or number within a journal volume',
  ARRAY['No. 3', 'Issue 12', 'no. 4'],
  'Integer typically preceded by ''Issue'', ''No.'', or ''Number'' label',
  'int', NULL, NULL, FALSE
),
(
  'conference', 'Conference Name', 'research',
  'Name of an academic conference or symposium where work was presented',
  ARRAY['NeurIPS 2023', 'IEEE CVPR 2024', 'ACL 2023', 'ICLR'],
  'Full or abbreviated conference name, often with year',
  NULL, NULL, NULL, FALSE
);
