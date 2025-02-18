// find images/aws/group/ -iname '*svg' | cut -d/ -f4 | cut -d. -f1 | sed s/_32// | sed s/_/-/ | tr [:upper:] [:lower:] | xargs -I{} echo '"": "{}",' 

export const knownAwsGroups: Record<string, string> = {
    "vpc": "virtual-private-cloud-vpc",
    "server": "server-contents",
    "account": "aws-account",
    "spot": "spot-fleet",
    "aws": "aws-cloud-logo",
    "cloud": "aws-cloud",
    "aws-dark": "aws-cloud-logo-dark",
    "dc": "corporate-data-center",
    "region": "region",
    "asg": "auto-scaling-group",
    "iot": "aws-iot-greengrass-deployment",
    "subnet": "private-subnet",
    "cloud-dark": "aws-cloud-dark",
    "public-subnet": "public-subnet",
    "ec2": "ec2-instance-contents",
    "generic": "generic",
};

export const awsGroupCss = `
        .container-virtual-private-cloud-vpc {
            border: solid 1px #8C4FFF;
        }


        .container-server-contents {
            border: solid 1px #7D8998;
        }


        .container-aws-account {
            border: solid 1px #E7157B;
        }


        .container-spot-fleet {
            border: solid 1px #ED7100;
        }


        .container-aws-cloud-logo {
            border: solid 1px #242F3E;
        }


        .container-aws-cloud {
            border: solid 1px #242F3E;
        }


        .container-aws-cloud-logo-dark {
            border: solid 1px #FFFFFF;
        }


        .container-corporate-data-center {
            border: solid 1px #7D8998;
        }


        .container-region {
            border: solid 1px #00A4A6;
        }


        .container-auto-scaling-group {
            border: solid 1px #ED7100;
        }


        .container-aws-iot-greengrass-deployment {
            border: solid 1px #7AA116;
        }


        .container-private-subnet {
            border: solid 1px #00A4A6;
        }


        .container-aws-cloud-dark {
            border: solid 1px #FFFFFF;
        }


        .container-public-subnet {
            border: solid 1px #7AA116;
        }


        .container-ec2-instance-contents {
            border: solid 1px #ED7100;
        }

`;

// find images/aws/service/ -iname '*svg' -exec basename {} ';' | cut -d. -f1 | sed s/_32// | sed s/_64// | sed s/_/-/ | tr [:upper:] [:lower:] | sed s/arch-// | sed s/aws-//  | sed s/amazon-// | xargs -I{} echo '"": "{}"'