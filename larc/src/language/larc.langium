grammar Larc

entry Model:
    Architecture Relations;

Architecture:
    'architecture' (title=STRING|ID) ArchDetails?;

fragment ArchDetails:
    '{' 
        attrs=Attributes? 
        nodes+=ArchNode* 
    '}';

Attributes:
    '[' 
        attrs+=Attribute* 
    ']';

Attribute:
    name=ID value=(ID | STRING | INT);

ArchNode:
    name=ID title=STRING? ArchDetails?;

Relations:
    'relations' '{' rels+=OneRel* '}';

OneRel:
    from=[ArchNode:ID] rel=REL to=[ArchNode:ID] attrs=Attributes?;

hidden terminal WS: /\s+/;
terminal ID: /[\w_][-\w_:()/."']*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
terminal REL: /[-<>=:]+/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
