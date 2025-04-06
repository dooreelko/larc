grammar Sharc

import "../../../larc/src/language/larc";

entry Sharc:
    architecture=ArcReference (includes+=Include | styles+=Styles | layout+=Layout)*;

ArcReference:
    'architecture' location=STRING;

Include:
    'include' location=STRING;

Styles:
    'style' '{' nodes+=Style* '}';

Style:
    name=ID '[' styles+=StyleValue* ']';

StyleValue:
    name=ID value=ID;

Layout:
    'layout' '{' layouts+=LayoutAttribute* '}';

LayoutAttribute:
    name=ID Attributes;

// Attributes:
//     '[' attrs+=Attribute* ']';

// Attribute:
//     name=ID value=ID;

// hidden terminal WS: /\s+/;
// terminal ID: /[\w_][-\w_:()/."%']*/;
// terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

// hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
// hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
