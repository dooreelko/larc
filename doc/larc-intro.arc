architecture "Web app" {
    AWS "Frankfurt" {
        VPC {
            ALB
            ECS "Fargate" {
                Task // [ kind "ECS" ]
                // [ count "0+" ]
            }
            RDS "Postgres"
            EFS
        }

        S3

        ECR
        Backup
    }
}

relations {
    ALB -> ECS

    ECS -> RDS
    ECS -> EFS
    ECS -> S3

    Task <- ECR
}