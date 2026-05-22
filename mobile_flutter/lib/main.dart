import 'package:flutter/material.dart';

void main() {
  runApp(const AuctionSiteApp());
}

class AuctionSiteApp extends StatelessWidget {
  const AuctionSiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'AuctionSite',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFC54320)),
        scaffoldBackgroundColor: const Color(0xFFF5F2E9),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final lots = [
      ('Vintage Coin Set', '\$235', '38 bids'),
      ('Rolex Datejust', '\$4,100', '72 bids'),
      ('Industrial Tool Bundle', '\$1,430', '61 bids'),
      ('Camera Body + Lens', '\$1,120', '41 bids'),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('AUCTIONSITE'),
        actions: [
          TextButton(onPressed: () {}, child: const Text('Sign In')),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Live + Timed + Local',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            const Text(
              'Find auctions near you and bid with confidence.',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search lots, categories, sellers...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Hot Lots', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                itemCount: lots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final item = lots[i];
                  return ListTile(
                    tileColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    title: Text(item.$1, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(item.$3),
                    trailing: Text(item.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
