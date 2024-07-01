grammar Sharc

entry Model:
    architecture=ArcReference (includes+=Include | styles+=Styles | nodes+=Nodes)*;

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

Nodes:
    'show' '{' nodes+=Node* '}';

Node:
    name=ID Attributes?;

Attributes:
    '[' attrs+=Attribute* ']';

Attribute:
    name=ID value=ID;

hidden terminal WS: /\s+/;
terminal ID: /[\w_][-\w_:()/."']*/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
