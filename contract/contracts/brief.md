Un utilisateur place un pari sur l'artiste qui va être top 1 des charts dans un pays donné (la liste est limité à bytes32("WW"),
bytes32("BR"),
bytes32("DE"),
bytes32("ES"),
bytes32("FR"),
bytes32("IT"),
bytes32("PT"),
bytes32("US") ; WW étant worldwide).

La liste des 10 artistes les plus populaires du pays en question est récupéré en amont. Deux cas de figure possibles :

-   l'utilisateur parie sur un artiste présent dans le top 10 du pays en question (la côté est progressive en fonction de la position dans le top, ex : de 1,20 à 3)
-   l'utilisateur parie sur un ariste non présent dans le top 10 du pays en question (dans de cas la côté est fixe : 3,50)

Le parieur récupère sa mise \* la côte une fois le temps imparti écoulé (1 jour par défaut).

Il doit y avoir une mise maximum (ex : 1eth)

Le contrat doit prévoir les cas suivants :

-   Le pays dans lequel le parieur parie n'est pas dans la liste
-   Un artiste est présent plusieurs fois dans le même top (sa côte doit donc diminuer)
-   Le parieur ne doit pouvoir parier qu'une seule fois pendant le temps imparti
-   Il a le droit de parier sur les autres pays disponible durant le même temps imparti

Un serveur node et des endpoints sont déjà en place :

-   Récupérer les infos sur le top 10 d'un pays particulier : http://localhost:8080/leaderboard/${country}?compact=true
-   Récupérer l'artiste numéro 1 du jour dans un pays particulier : http://localhost:8080/daily-winner/${country}

Il faut mettre en place un oracle pour récupérer ces infos on-chain.

On utilisera hardhat avec solidity dans sa version 0.8.24

Les utilitaires oppenzeppelin contracts suivants sont utilisables :
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

On utilise les custom errors plutôt que les require.

Les artistes et les pays sont représentés dans le contrat en bytes32.
